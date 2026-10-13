/** Versioned, allowlisted appearance schema. Never exports API or chat settings. */
export const THEME_VERSION = 1;
export const defaults = Object.freeze({preset:'qq',mode:'light',layout:'qq',accent:'#0099ff',fontSize:15,bubbleRadius:16,avatarShape:'rounded',bubbleStyle:'bubbles',showTime:true,background:false,density:'comfortable',nightStart:'20:00',dayStart:'07:00',reducedMotion:false});
export const presets = Object.freeze([
    {id:'qq',name:'晴空蓝',subtitle:'QQ 风格 · 清爽蓝白',accent:'#0099ff'},
    {id:'mint',name:'薄荷绿',subtitle:'安静清新',accent:'#16a085'},
    {id:'violet',name:'浅薰衣草',subtitle:'柔和紫色',accent:'#8561db'},
    {id:'rose',name:'桃桃粉',subtitle:'温柔暖色',accent:'#da5b89'},
    {id:'sand',name:'奶油米',subtitle:'纸张般的阅读感',accent:'#9c7a49'},
    {id:'slate',name:'石墨灰',subtitle:'低调专注',accent:'#61768f'},
]);
const oneOf=(v,allowed,fallback)=>allowed.includes(v)?v:fallback;
const number=(v,min,max,fallback)=>typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,Math.round(v))):fallback;
export function normalizeTheme(input={}) {
    const s=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
    const out={...defaults};
    out.preset=oneOf(s.preset,presets.map(p=>p.id),defaults.preset);
    out.accent=typeof s.accent==='string'&&/^#[0-9a-f]{6}$/i.test(s.accent)?s.accent:presets.find(p=>p.id===out.preset).accent;
    out.mode=oneOf(s.mode,['light','dark','system','schedule'],defaults.mode);
    out.layout=oneOf(s.layout,['qq','focus'],defaults.layout);
    out.avatarShape=oneOf(s.avatarShape,['circle','rounded','square'],defaults.avatarShape);
    out.bubbleStyle=oneOf(s.bubbleStyle,['bubbles','document'],defaults.bubbleStyle);
    out.density=oneOf(s.density,['comfortable','compact'],defaults.density);
    out.fontSize=number(s.fontSize,12,22,defaults.fontSize);
    out.bubbleRadius=number(s.bubbleRadius,0,28,defaults.bubbleRadius);
    for(const k of ['showTime','background','reducedMotion']) if(typeof s[k]==='boolean')out[k]=s[k];
    for(const k of ['nightStart','dayStart']) if(typeof s[k]==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s[k]))out[k]=s[k];
    if(out.nightStart===out.dayStart){out.nightStart=defaults.nightStart;out.dayStart=defaults.dayStart;}
    return out;
}
export function resolveDark(theme, date=new Date(), systemDark=false) {
    if(theme.mode==='dark')return true;
    if(theme.mode==='system')return systemDark;
    if(theme.mode!=='schedule')return false;
    const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
    const start=minutes(theme.nightStart),end=minutes(theme.dayStart),now=date.getHours()*60+date.getMinutes();
    if(start===end)return false;
    return start>end ? now>=start||now<end : now>=start&&now<end;
}
export function exportTheme(theme) { return {kind:'sillytavern-studio-theme',version:THEME_VERSION,appearance:normalizeTheme(theme)}; }
export function importTheme(raw) {
    if(typeof raw!=='string'||raw.length>32768)throw new Error('请导入不超过 32 KB 的主题 JSON。');
    const data=JSON.parse(raw);
    if(data?.kind!=='sillytavern-studio-theme'||data.version!==THEME_VERSION||!data.appearance||typeof data.appearance!=='object'||Array.isArray(data.appearance))throw new Error('这不是受支持的 Studio 主题文件。');
    return normalizeTheme(data.appearance);
}
