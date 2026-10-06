// Search-based player for the Mega Man X intro stage. Writes an input script usable by rec.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <unistd.h>
#include "snes.h"
#define B_B 0x1
#define B_Y 0x2
#define B_START 0x8
#define B_RIGHT 0x80
#define B_LEFT 0x40
#define B_A 0x100

static uint8_t* readFile(const char* path, int* len) { FILE* f = fopen(path, "rb"); if(!f) return NULL; fseek(f, 0, SEEK_END); *len = ftell(f); fseek(f, 0, SEEK_SET); uint8_t* d = malloc(*len); fread(d, 1, *len, f); fclose(f); return d; }

static Snes* snes;
static int inputs[200000]; // per-frame button mask
static int total = 0;

static void step(int mask) { for(int b = 0; b < 12; b++) snes_setButtonState(snes, 1, b, (mask >> b) & 1); snes_runFrame(snes); }
static int xpos() { return snes->ram[0xBAD] | (snes->ram[0xBAE] << 8); }
static int ypos() { return snes->ram[0xBB0] | (snes->ram[0xBB1] << 8); }
static int hp() { return snes->ram[0xBCF]; }
static int lives() { return snes->ram[0x1F80]; }
static int ehp() { int h = snes->ram[0xE8F]; return (h > 0 && h <= 32) ? h : 0; }

typedef struct { uint8_t* buf; int size; } State;
static State saveS() { State s; s.buf = malloc(0x200000); s.size = snes_saveState(snes, s.buf); return s; }
static void loadS(State s) { snes_loadState(snes, s.buf, s.size); }

int main(int argc, char** argv) {
  const char* rom = argv[1]; const char* state = argv[2]; const char* out = argv[3]; int maxFrames = atoi(argv[4]); unsigned seed = atoi(argv[5]);
  srand(seed);
  int len; uint8_t* data = readFile(rom, &len); snes = snes_init(); snes_loadRom(snes, data, len);
  int sl; uint8_t* sd = readFile(state, &sl); snes_loadState(snes, sd, sl);
  if(argc > 7) {
    // prefix mode: state is at frame argv[7]; replay nothing, just load inputs from prefix script argv[6]
    int pf = atoi(argv[7]); FILE* f = fopen(argv[6], "r"); char line[256]; int a, b, m;
    while(fgets(line, sizeof line, f)) if(sscanf(line, "%d %d %i", &a, &b, &m) == 3) for(int i = a; i <= b && i < pf; i++) inputs[i] |= m;
    fclose(f); total = pf;
  } else {
  // press start twice, wait for stage
  for(int f = 0; f < 520; f++) { int m = (f < 10 || (f >= 300 && f < 310)) ? B_START : 0; inputs[total++] = m; step(m); }
  }
  fprintf(stderr, "stage start: x=%d y=%d hp=%d lives=%d\n", xpos(), ypos(), hp(), lives());
  const int HMAX = 240; int H = 120, N = 14; const int COMMIT = 40;
  int stall = 0; int lastBestX = xpos();
  State hist[64]; int nh = 0;
  while(total < maxFrames) {
    State base = saveS(); int bx = xpos(), bhp = hp(), bl = lives(), behp = ehp();
    H = stall > 3 ? 200 : 120; N = stall > 3 ? 20 : 14; int bestScore = -1000000; int bestSeq[HMAX]; bool found = false;
    for(int c = 0; c < N; c++) {
      loadS(base);
      int seq[HMAX];
      // random macro: hold right; jump at random start for random length; dash sometimes; shoot taps
      int js = rand() % (H - 20), jl = 8 + rand() % 24; int dash = (rand() % 3 == 0); int js2 = rand() % (H - 20), jl2 = 4 + rand() % 20; int twojump = rand() % 2;
      int stallMode = stall > 3;
      int shootEvery = stallMode ? (8 + rand() % 10) : (20 + rand() % 40); int noRight = (c == N - 1) ? 1 : 0;
      int rep = (c % 3 == 1) || (stallMode && c % 2 == 0); int rp = 16 + rand() % 16, rl = 6 + rand() % 10, r0 = rand() % 30;
      int retreat = stallMode && (c % 5 == 4); int rt = 20 + rand() % 60;
      int charge = stallMode && (c % 4 == 2); int cl = 70 + rand() % 50;
      for(int i = 0; i < H; i++) {
        int m = noRight ? 0 : B_RIGHT;
        if(retreat && i < rt) m = B_LEFT;
        if(rep) { if(i >= r0 && ((i - r0) % rp) < rl) m |= B_B; }
        else {
          if(i >= js && i < js + jl) m |= B_B;
          if(twojump && i >= js2 && i < js2 + jl2) m |= B_B;
        }
        if(charge) { if((i % (cl + 6)) < cl) m |= B_Y; }
        else if((i % shootEvery) < 3) m |= B_Y;
        seq[i] = m;
      }
      int score = 0; bool dead = false; int minHp = bhp;
      for(int i = 0; i < H; i++) {
        step(seq[i]);
        if(hp() < minHp) minHp = hp();
        if(lives() < bl || hp() == 0 || ypos() > 0x1f0) { dead = true; break; }
      }
      if(dead) continue;
      int dx = xpos() - bx;
      int edmg = (behp > 0 && ehp() < behp) ? (behp - ehp()) : (behp > 0 && ehp() == 0 ? behp : 0);
      score = dx * 3 - (bhp - minHp) * (stallMode ? 20 : 80) + (hp() - bhp) * 50 + edmg * 60 + (rand() % 5);
      if(score > bestScore) { bestScore = score; memcpy(bestSeq, seq, sizeof(int) * H); found = true; }
    }
    if(!found) {
      // backtrack
      if(nh > 0) { nh--; loadS(hist[nh]); free(hist[nh].buf); total -= COMMIT; fprintf(stderr, "backtrack to frame %d\n", total); free(base.buf); stall++; continue; }
      else { fprintf(stderr, "stuck with no history\n"); break; }
    }
    loadS(base);
    for(int i = 0; i < COMMIT; i++) { inputs[total++] = bestSeq[i]; step(bestSeq[i]); }
    if(nh < 64) hist[nh++] = base; else { free(hist[0].buf); memmove(hist, hist + 1, sizeof(State) * 63); hist[63] = base; }
    if(xpos() > lastBestX + 8) { lastBestX = xpos(); stall = 0; } else stall++;
    { FILE* pf = fopen(out, "w"); int cur = inputs[0], start = 0;
      for(int i = 1; i <= total; i++) { if(i == total || inputs[i] != cur) { if(cur) fprintf(pf, "%d %d 0x%x\n", start, i - 1, cur); if(i < total) { cur = inputs[i]; start = i; } } }
      fclose(pf); }
    if(total % 400 < COMMIT) fprintf(stderr, "frame %d x=%d y=%d hp=%d lives=%d stall=%d\n", total, xpos(), ypos(), hp(), lives(), stall);
  }
  FILE* f = fopen(out, "w");
  int cur = inputs[0], start = 0;
  for(int i = 1; i <= total; i++) { if(i == total || inputs[i] != cur) { if(cur) fprintf(f, "%d %d 0x%x\n", start, i - 1, cur); if(i < total) { cur = inputs[i]; start = i; } } }
  fclose(f);
  fprintf(stderr, "done, %d frames, x=%d hp=%d lives=%d\n", total, xpos(), hp(), lives());
  return 0;
}
