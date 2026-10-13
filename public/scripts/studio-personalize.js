import {defaults,presets,normalizeTheme,resolveDark,exportTheme,importTheme} from './studio-theme-model.js';
const $=s=>document.querySelector(s);
let prefs,save,openSettings,ctx,events,eventTypes,isBusy,entries=[],listMode='recent',busy=false,refreshTimer;
const media=matchMedia('(prefers-color-scheme: dark)');
function theme(){return prefs.appearance;}
function commit(){prefs.appearance=normalizeTheme(prefs.appearance);prefs.background=theme().background;prefs.density=theme().density;applyAppearance();save();}
export function applyAppearance() {
    if(!prefs)return;
    const t=theme(),dark=resolveDark(t,new Date(),media.matches),body=document.body;
    body.dataset.studioSkin=dark?'dark':'light';body.dataset.studioLayout=t.layout;body.dataset.studioAvatar=t.avatarShape;body.dataset.studioBubbles=t.bubbleStyle;
    body.dataset.studioDensity=t.density;body.classList.toggle('studio-no-time',!t.showTime);body.classList.toggle('studio-reduce-motion',t.reducedMotion);body.classList.toggle('st-studio-background',t.background);
    body.style.setProperty('--qq-accent',t.accent);body.style.setProperty('--qq-font',t.fontSize+'px');body.style.setProperty('--qq-radius',t.bubbleRadius+'px');
    const status=$('#qq-theme-status');if(status)status.textContent=`${dark?'深色':'浅色'} · ${t.mode==='system'?'跟随系统':t.mode==='schedule'?'按时间自动切换':'手动模式'}`;
    // No settings writes on clock ticks or system appearance changes.
}
function field(title,description,control){return `<div class="studio-control"><div><strong>${title}</strong><p>${description}</p></div>${control}</div>`;}
function select(id,label,items){return `<select id="qq-${id}" aria-label="${label}">${items.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select>`;}
function toggle(id,label){return `<label class="studio-switch"><input id="qq-${id}" type="checkbox" aria-label="${label}"><span></span></label>`;}
function announce(message,error=false){const out=$('#qq-feedback');if(out){out.textContent=message;out.dataset.error=String(error);}}
export function renderPersonalization(host) {
    host.innerHTML=`<div class="qq-personal-hero"><div><span class="qq-eyebrow">MAKE IT YOURS</span><h3>把聊天空间，变成你的样子。</h3><p>主题随心切换，偏好自动保存。只改变外观，不动聊天和模型配置。</p></div><span class="qq-hero-mark"><i class="fa-solid fa-palette"></i></span></div>
    <div class="qq-preview" aria-label="主题即时预览"><div class="qq-preview-bar"><span class="qq-preview-dot"></span>聊天预览 <small id="qq-theme-status"></small></div><div class="qq-preview-message"><span class="qq-preview-avatar">S</span><span>你好，今天想聊些什么？</span></div><div class="qq-preview-message own"><span>就从喜欢的颜色开始吧。</span><span class="qq-preview-avatar">我</span></div></div>
    <section class="studio-card"><h3>主题预设 · 六种配色</h3><div class="qq-presets">${presets.map(p=>`<button class="qq-preset" data-preset="${p.id}" aria-label="应用${p.name}主题"><span class="qq-swatch" style="--swatch:${p.accent}"><i></i><b></b></span><strong>${p.name}</strong><small>${p.subtitle}</small></button>`).join('')}</div>
    ${field('自定义强调色','导航选中态、发送按钮和主题点缀随之更新。','<input id="qq-accent" type="color" aria-label="自定义强调色">')}
    </section><section class="studio-card"><h3>自动化外观</h3>
    ${field('明暗切换','系统模式响应设备外观；定时模式使用这台设备的本地时间。',select('mode','明暗切换',[['light','始终浅色'],['dark','始终深色'],['system','跟随系统'],['schedule','按时间切换']]))}
    <div id="qq-schedule"><div class="studio-control"><div><strong>夜间时段</strong><p>到点自动换肤；页面关闭期间不运行，重新打开时立即校准。起止时间不能相同。</p></div><div class="qq-times"><label>深色开始<input id="qq-nightStart" type="time" aria-label="深色开始"></label><label>浅色开始<input id="qq-dayStart" type="time" aria-label="浅色开始"></label></div></div></div>
    ${field('减少动画','关闭过渡动画，让界面更安静。',toggle('reducedMotion','减少动画'))}</section>
    <section class="studio-card"><h3>布局与消息</h3>
    ${field('工作区布局','QQ 风格三栏：功能栏 / 会话列表 / 聊天区。窄屏自动折叠。',select('layout','工作区布局',[['qq','QQ 风格三栏'],['focus','专注双栏']]))}
    ${field('消息样式','聊天气泡左右分列；文档模式适合长篇阅读。',select('bubbleStyle','消息样式',[['bubbles','左右气泡'],['document','文档阅读']]))}
    ${field('字体大小','正式消息和主题预览即时更新。','<div class="qq-range"><input id="qq-fontSize" type="range" min="12" max="22" step="1" aria-label="字体大小"><output id="qq-fontSize-value"></output></div>')}
    ${field('气泡圆角','从利落直角到柔软圆角，自由调整。','<div class="qq-range"><input id="qq-bubbleRadius" type="range" min="0" max="28" step="1" aria-label="气泡圆角"><output id="qq-bubbleRadius-value"></output></div>')}
    ${field('头像形状','头像图片仍通过“我的身份”和“角色与群聊”更换。',select('avatarShape','头像形状',[['rounded','圆角方形'],['circle','圆形'],['square','方形']]))}
    ${field('显示时间戳','隐藏或显示消息旁的发送时间。',toggle('showTime','显示时间戳'))}
    ${field('消息密度','影响消息间距，不截断内容。',select('density','消息密度',[['comfortable','舒适'],['compact','紧凑']]))}
    ${field('显示聊天背景','使用原生背景库中的图片。开启后，聊天区会显示背景。',toggle('background','显示聊天背景'))}
    <div class="qq-links"><button id="qq-background-link"><i class="fa-solid fa-image"></i> 选择背景</button><button id="qq-avatar-link"><i class="fa-solid fa-user"></i> 更换我的头像</button></div></section>
    <section class="studio-card"><h3>我的方案</h3><p>保存多个外观方案，随时一键恢复。导入 / 导出仅包含外观，不含密钥、聊天或人设。</p><div class="qq-profile-save"><input id="qq-profile-name" maxlength="40" placeholder="方案名称，例如：夜读模式" aria-label="方案名称"><button id="qq-profile-save">保存当前方案</button></div><div id="qq-profiles"></div><div class="qq-links"><button id="qq-export"><i class="fa-solid fa-download"></i> 导出主题</button><label class="qq-import" for="qq-import">导入主题<input id="qq-import" type="file" accept=".json,application/json" hidden></label><button id="qq-reset">恢复蓝白默认</button></div><div id="qq-feedback" role="status" aria-live="polite"></div></section>`;
    syncControls();renderProfiles();
    host.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const p=presets.find(p=>p.id===b.dataset.preset);prefs.appearance.preset=p.id;prefs.appearance.accent=p.accent;commit();syncControls();announce(`已应用${p.name}，明暗规则和布局保持不变。`);});
    for(const key of Object.keys(defaults)){
        const el=$('#qq-'+key);if(!el)continue;
        const event=['accent','fontSize','bubbleRadius'].includes(key)?'input':'change';
        el.addEventListener(event,()=>{
            const value=el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value;
            if(['nightStart','dayStart'].includes(key)){
                const other=key==='nightStart'?'dayStart':'nightStart';
                if(!el.value||el.value===theme()[other]){el.value=theme()[key];announce('起止时间不能相同，也不能为空。',true);return;}
            }
            prefs.appearance[key]=value;commit();syncControls();
        });
    }
    $('#qq-background-link').onclick=()=>openSettings('background');$('#qq-avatar-link').onclick=()=>openSettings('persona');
    $('#qq-profile-save').onclick=()=>{
        const name=$('#qq-profile-name').value.trim();if(!name){announce('先给方案起个名字。',true);return;}
        if(prefs.appearanceProfiles.length>=12){announce('最多保存 12 个方案，请先删除不再需要的方案。',true);return;}
        prefs.appearanceProfiles.push({id:crypto.randomUUID(),name,appearance:normalizeTheme(theme())});save();renderProfiles();$('#qq-profile-name').value='';announce('方案已保存。');
    };
    $('#qq-export').onclick=()=>{
        const url=URL.createObjectURL(new Blob([JSON.stringify(exportTheme(theme()),null,2)],{type:'application/json'}));
        const a=document.createElement('a');a.href=url;a.download='SillyTavern-外观主题.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);announce('已导出外观主题，不含账户数据。');
    };
    $('#qq-import').onchange=async e=>{
        const file=e.target.files[0];if(!file)return;
        try{if(file.size>32768)throw new Error('主题文件不能超过 32 KB。');prefs.appearance=importTheme(await file.text());commit();syncControls();announce('主题导入成功。');}catch(error){announce(error.message||'主题文件无法解析。',true);}finally{e.target.value='';}
    };
    $('#qq-reset').onclick=()=>{prefs.appearance={...defaults};commit();syncControls();announce('已恢复蓝白默认，已保存方案仍保留。');};
}
function syncControls(){
    for(const [key,value]of Object.entries(theme())){const el=$('#qq-'+key);if(!el)continue;if(el.type==='checkbox')el.checked=value;else el.value=value;}
    for(const key of ['fontSize','bubbleRadius']){const el=$('#qq-'+key+'-value');if(el)el.textContent=theme()[key]+'px';}
    $('#qq-schedule').hidden=theme().mode!=='schedule';
    document.querySelectorAll('[data-preset]').forEach(b=>{const active=presets.find(p=>p.id===b.dataset.preset).accent.toLowerCase()===theme().accent.toLowerCase();b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    applyAppearance();
}
function renderProfiles(){
    const root=$('#qq-profiles');root.replaceChildren();
    if(!prefs.appearanceProfiles.length){root.textContent='还没有保存的方案。';return;}
    for(const p of prefs.appearanceProfiles){
        const line=document.createElement('div');line.className='qq-profile';
        const name=document.createElement('span');name.textContent=p.name;
        const use=document.createElement('button');use.textContent='应用';use.setAttribute('aria-label','应用方案 '+p.name);use.onclick=()=>{prefs.appearance=normalizeTheme(p.appearance);commit();syncControls();announce(`已应用“${p.name}”。`);};
        const remove=document.createElement('button');remove.textContent='删除';remove.setAttribute('aria-label','删除方案 '+p.name);remove.onclick=()=>{if(!confirm(`删除外观方案“${p.name}”？不会删除聊天。`))return;prefs.appearanceProfiles=prefs.appearanceProfiles.filter(x=>x.id!==p.id);save();renderProfiles();};
        line.append(name,use,remove);root.append(line);
    }
}
function renderList(){
    const host=$('#qq-conversations');if(!host)return;
    const q=$('#qq-list-search').value.trim().toLowerCase(),c=ctx();
    const data=listMode==='recent'?entries:c.characters.map((ch,id)=>({name:ch.name,avatar:ch.avatar,characterId:id,subtitle:'角色 · 点击继续对话'}));
    const matches=data.filter(x=>x.name.toLowerCase().includes(q));host.replaceChildren();
    if(!matches.length){const empty=document.createElement('p');empty.className='qq-list-empty';empty.textContent=q?'没有匹配的会话或角色':listMode==='recent'?'还没有最近会话。选择“角色”开始聊天。':'还没有角色，请先创建或导入角色卡。';host.append(empty);}
    for(const entry of matches){
        const b=document.createElement('button');b.className='qq-conversation';b.title=entry.name;
        const active=entry.group?String(entry.group)===String(c.groupId):entry.avatar===c.characters[c.characterId]?.avatar;
        b.classList.toggle('active',active&&(!entry.file||entry.file===c.chatId));
        const img=document.createElement('img');img.alt='';img.src=entry.avatar?c.getThumbnailUrl('avatar',entry.avatar):'img/ai4.png';img.onerror=()=>{img.onerror=null;img.src='img/ai4.png';};
        const texts=document.createElement('span'),name=document.createElement('strong'),sub=document.createElement('small');name.textContent=entry.name;sub.textContent=entry.subtitle||'继续这段对话';texts.append(name,sub);b.append(img,texts);
        b.onclick=async()=>{
            if(busy||isBusy()){announce('正在生成，请先停止生成再切换会话。',true);return;}
            busy=true;b.disabled=true;
            try{
                const current=ctx();
                if(entry.group){await current.openGroupChat(entry.group,entry.file);}
                else{
                    const id=current.characters.findIndex(x=>x.avatar===entry.avatar);if(id<0)return;
                    await current.selectCharacterById(id,{switchMenu:false});
                    // Selection can be refused while a save/generation is active.
                    if(String(ctx().characterId)!==String(id))return;
                    if(entry.file&&ctx().chatId!==entry.file)await ctx().openCharacterChat(entry.file);
                }
                document.body.classList.remove('qq-list-open');renderList();
            }catch{const error=document.createElement('p');error.className='qq-list-empty';error.textContent='打开失败，请通过聊天记录入口重试。';host.prepend(error);}finally{busy=false;b.disabled=false;}
        };host.append(b);
    }
    $('#qq-list-count').textContent=String(matches.length);
}
async function loadRecent(){
    try{
        const c=ctx(),response=await fetch('/api/chats/recent',{method:'POST',headers:c.getRequestHeaders(),body:JSON.stringify({max:40,pinned:[]}),cache:'no-cache'});
        if(!response.ok)throw new Error('recent');const raw=await response.json();if(!Array.isArray(raw))throw new Error('shape');
        entries=raw.map(x=>{
            const char=c.characters.find(ch=>ch.avatar===x.avatar),group=c.groups.find(g=>String(g.id)===String(x.group));if(!char&&!group)return null;
            return {name:char?.name||group.name,avatar:char?.avatar,group:group?.id,file:String(x.file_name).replace(/\.jsonl$/,''),subtitle:typeof x.mes==='string'&&x.mes.trim()&&x.mes!=='[The message is empty]'?x.mes.replace(/<[^>]*>/g,'').slice(0,70):'点击继续对话'};
        }).filter(Boolean);renderList();
    }catch{const el=$('#qq-conversations');if(el)el.textContent='暂时无法读取最近会话，请切换到角色列表。';}
}
export function initPersonalization(options){
    ({prefs,save,openSettings,ctx,events,eventTypes,isBusy}=options);
    prefs.appearance=normalizeTheme(prefs.appearance||{...defaults,background:prefs.background,density:prefs.density});
    prefs.appearanceProfiles=Array.isArray(prefs.appearanceProfiles)?prefs.appearanceProfiles.slice(0,12).filter(p=>typeof p?.name==='string'&&typeof p.id==='string').map(p=>({id:p.id,name:p.name.slice(0,40),appearance:normalizeTheme(p.appearance)})):[];
    save();
    document.body.insertAdjacentHTML('beforeend',`<aside id="qq-list" aria-label="会话与角色列表"><div class="qq-list-heading"><div><small>MY SPACE</small><h2>消息 <span id="qq-list-count">0</span></h2></div><button id="qq-list-add" aria-label="添加或管理角色"><i class="fa-solid fa-plus"></i></button></div><input id="qq-list-search" placeholder="搜索会话或角色" aria-label="搜索会话或角色"><div class="qq-list-tabs"><button data-list-mode="recent" class="active">最近会话</button><button data-list-mode="contacts">我的角色</button></div><div id="qq-conversations"></div><button id="qq-personalize-link"><i class="fa-solid fa-palette"></i> 装扮我的空间 <i class="fa-solid fa-angle-right"></i></button></aside>`);
    const quick=document.createElement('button');quick.className='studio-nav-item qq-rail-theme';quick.title='主题与自动化';quick.innerHTML='<i class="fa-solid fa-palette"></i><span>个性化</span>';quick.onclick=()=>openSettings('personalize');$('#studio-nav .studio-nav-bottom').prepend(quick);
    document.querySelectorAll('#studio-nav button').forEach(b=>{if(!b.title)b.title=b.textContent.trim();b.setAttribute('aria-label',b.title);});
    const listButton=document.createElement('button');listButton.id='qq-list-toggle';listButton.setAttribute('aria-label','展开会话列表');listButton.innerHTML='<i class="fa-regular fa-comments"></i>';listButton.onclick=()=>document.body.classList.toggle('qq-list-open');$('#studio-header').prepend(listButton);
    $('#qq-list-search').oninput=renderList;$('#qq-list-add').onclick=()=>openSettings('characters');$('#qq-personalize-link').onclick=()=>openSettings('personalize');
    document.querySelectorAll('[data-list-mode]').forEach(b=>b.onclick=()=>{listMode=b.dataset.listMode;document.querySelectorAll('[data-list-mode]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});renderList();});
    $('#studio-home').addEventListener('click',()=>{if(theme().layout==='qq'&&innerWidth<=900)document.body.classList.toggle('qq-list-open');});
    media.addEventListener('change',applyAppearance);setInterval(applyAppearance,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)applyAppearance();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')document.body.classList.remove('qq-list-open');});
    for(const type of [eventTypes.CHAT_CHANGED,eventTypes.CHAT_LOADED,eventTypes.MESSAGE_RECEIVED,eventTypes.CHAT_CREATED,eventTypes.CHAT_DELETED,eventTypes.CHARACTER_EDITED,eventTypes.CHARACTER_DELETED,eventTypes.CHAT_RENAMED])if(type)events.on(type,()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(loadRecent,400);});
    applyAppearance();loadRecent();
}
