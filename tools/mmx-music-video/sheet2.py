import sys, subprocess, numpy as np
from PIL import Image, ImageDraw
S='/tmp/claude-0/-home-user-pixeltrophycase/416eb1b9-85f1-5892-8318-d0d79128932f/scratchpad'
src, name, f0, f1, step = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
p=subprocess.run(['ffmpeg','-loglevel','error','-i',src,'-vf',f'select=between(n\\,{f0}\\,{f1})*not(mod(n-{f0}\\,{step})),scale=192:168','-vsync','0','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True)
d=np.frombuffer(p.stdout,dtype=np.uint8).reshape(-1,168,192,3)
for s in range(0,len(d),36):
    sheet=Image.new('RGB',(192*6,168*6)); dr=ImageDraw.Draw(sheet)
    for i in range(36):
        if s+i<len(d):
            x,y=(i%6)*192,(i//6)*168
            sheet.paste(Image.fromarray(d[s+i]),(x,y)); dr.rectangle([x,y,x+60,y+12],fill=(0,0,0)); dr.text((x+2,y),str(f0+(s+i)*step),fill=(255,255,0))
    sheet.save(f'{S}/out/{name}_{s//36}.png')
print(len(d))
