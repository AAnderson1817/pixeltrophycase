// Headless LakeSnes recorder: raw BGRX video to stdout (or file), raw s16le stereo audio to file.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <unistd.h>
#include "snes.h"
void snes_runApuOnlyFrame(Snes* snes);
extern int dspVoiceMuteMask;
extern long dspVoiceActivity[8];

typedef struct { int f1, f2, mask; } Ev;
static Ev evs[100000]; static int nev = 0;

static uint8_t* readFile(const char* path, int* len) {
  FILE* f = fopen(path, "rb"); if(!f) return NULL;
  fseek(f, 0, SEEK_END); *len = ftell(f); fseek(f, 0, SEEK_SET);
  uint8_t* d = malloc(*len); fread(d, 1, *len, f); fclose(f); return d;
}

int main(int argc, char** argv) {
  const char* rom = NULL; const char* vout = NULL; const char* aout = NULL; const char* script = NULL;
  const char* loadState = NULL; const char* saveState = NULL; int saveAt = -1; const char* ramOut = NULL; int ramEvery = 0;
  const char* voiceLog = NULL; int frames = 600; int skipVideo = 0; const char* hexWatch = NULL; int apuOnlyFrom = -1; const char* muteSched = NULL;
  for(int i = 1; i < argc; i++) {
    if(!strcmp(argv[i], "--rom")) rom = argv[++i];
    else if(!strcmp(argv[i], "--video")) vout = argv[++i];
    else if(!strcmp(argv[i], "--audio")) aout = argv[++i];
    else if(!strcmp(argv[i], "--script")) script = argv[++i];
    else if(!strcmp(argv[i], "--frames")) frames = atoi(argv[++i]);
    else if(!strcmp(argv[i], "--load")) loadState = argv[++i];
    else if(!strcmp(argv[i], "--save")) { saveAt = atoi(argv[++i]); saveState = argv[++i]; }
    else if(!strcmp(argv[i], "--ram")) { ramOut = argv[++i]; ramEvery = atoi(argv[++i]); }
    else if(!strcmp(argv[i], "--mute")) dspVoiceMuteMask = strtol(argv[++i], NULL, 0);
    else if(!strcmp(argv[i], "--voicelog")) voiceLog = argv[++i];
    else if(!strcmp(argv[i], "--novideo")) skipVideo = 1;
    else if(!strcmp(argv[i], "--watch")) hexWatch = argv[++i];
    else if(!strcmp(argv[i], "--apuonly")) apuOnlyFrom = atoi(argv[++i]);
  }
  int vfd = dup(1); dup2(2, 1);
  int len; uint8_t* data = readFile(rom, &len); if(!data) { fprintf(stderr, "no rom\n"); return 1; }
  Snes* snes = snes_init();
  if(!snes_loadRom(snes, data, len)) { fprintf(stderr, "load failed\n"); return 1; }
  snes_setPixelFormat(snes, 0);
  if(loadState) { int sl; uint8_t* sd = readFile(loadState, &sl); if(!sd || !snes_loadState(snes, sd, sl)) { fprintf(stderr, "state load failed\n"); return 1; } free(sd); }
  if(script) {
    FILE* f = fopen(script, "r"); char line[256];
    while(fgets(line, sizeof line, f)) { if(line[0] == '#' || line[0] == '\n') continue; Ev e; if(sscanf(line, "%d %d %i", &e.f1, &e.f2, &e.mask) == 3) evs[nev++] = e; }
    fclose(f);
  }
  FILE* vf = NULL; if(vout && !skipVideo) vf = strcmp(vout, "-") ? fopen(vout, "wb") : fdopen(vfd, "wb");
  FILE* af = aout ? fopen(aout, "wb") : NULL;
  FILE* rf = ramOut ? fopen(ramOut, "wb") : NULL;
  FILE* lf = voiceLog ? fopen(voiceLog, "w") : NULL;
  uint8_t* pix = calloc(512 * 480 * 4, 1); uint8_t* small = malloc(256 * 224 * 3);
  int16_t* samples = malloc(534 * 2 * sizeof(int16_t));
  uint8_t* stateBuf = malloc(0x200000);
  // watch list: comma separated hex addresses in WRAM
  int watch[64]; int nwatch = 0;
  if(hexWatch) { char* c = strdup(hexWatch); for(char* t = strtok(c, ","); t; t = strtok(NULL, ",")) watch[nwatch++] = strtol(t, NULL, 16); }
  for(int fr = 0; fr < frames; fr++) {
    int mask = 0; for(int i = 0; i < nev; i++) if(fr >= evs[i].f1 && fr <= evs[i].f2) mask |= evs[i].mask;
    for(int b = 0; b < 12; b++) snes_setButtonState(snes, 1, b, (mask >> b) & 1);
    memset(dspVoiceActivity, 0, sizeof dspVoiceActivity);
    if(apuOnlyFrom >= 0 && fr >= apuOnlyFrom) snes_runApuOnlyFrame(snes); else snes_runFrame(snes);
    if(vf) {
      snes_setPixels(snes, pix);
      // downsample 512x480 -> 256x224 (lines 16..463), take every other column
      for(int y = 0; y < 224; y++) { uint8_t* src = pix + (16 + y * 2) * 2048; uint8_t* dst = small + y * 256 * 3;
        for(int x = 0; x < 256; x++) { uint8_t* p = src + x * 8; dst[x*3] = p[2]; dst[x*3+1] = p[1]; dst[x*3+2] = p[0]; } }
      fwrite(small, 1, 256 * 224 * 3, vf);
    }
    if(af) { snes_setSamples(snes, samples, 534); fwrite(samples, 4, 534, af); }
    if(lf) { fprintf(lf, "%d", fr); for(int c = 0; c < 8; c++) fprintf(lf, " %ld", dspVoiceActivity[c]); if(nwatch) { fprintf(lf, " |"); for(int w = 0; w < nwatch; w++) fprintf(lf, " %02x", snes->ram[watch[w]]); } fprintf(lf, "\n"); }
    if(rf && ramEvery && fr % ramEvery == 0) fwrite(snes->ram, 1, 0x20000, rf);
    if(fr == saveAt) { int sz = snes_saveState(snes, stateBuf); FILE* sf = fopen(saveState, "wb"); fwrite(stateBuf, 1, sz, sf); fclose(sf); }
  }
  if(vf) fclose(vf); if(af) fclose(af); if(rf) fclose(rf); if(lf) fclose(lf);
  return 0;
}
