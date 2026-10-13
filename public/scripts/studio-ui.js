import { eventSource, event_types } from './events.js';
import { oai_settings } from './openai.js';
import { extension_settings } from './extensions.js';
import { getContext } from './st-context.js';
import { yaml } from '../lib.js';
import { configureDeepSeek } from './studio-policy.js';
import { initPersonalization, renderPersonalization, applyAppearance } from './studio-personalize.js';

const groups = [
    ['配置', [
        ['quick', '生成与思考', 'sliders', '上下文、回复额度、思考模式和展示方式'],
        ['api', 'API 与模型', 'plug', '服务商、连接配置、密钥和模型选择', 'rm_api_block', 'sys-settings-button'],
        ['sampling', '采样与预设', 'wave-square', '温度、采样参数、提示词管理器与生成预设', 'left-nav-panel', 'ai-config-button'],
    ]],
    ['个性化', [
        ['personalize', '主题与自动化', 'palette', 'QQ 风格、主题换肤、自动深色、气泡、字体、布局、个性化方案导入导出'],
        ['characters', '角色与群聊', 'address-card', 'AI 人设、角色卡、头像、群聊和开场白', 'right-nav-panel', 'rightNavHolder'],
        ['persona', '我的身份', 'user', '用户人设、名字、头像与默认身份', 'PersonaManagement', 'persona-management-button'],
        ['background', '聊天背景', 'image', '背景图片、布局与背景管理', 'Backgrounds', 'backgrounds-button'],
        ['appearance', '外观与交互', 'palette', '主题、字体、语言、消息显示与快捷操作', 'user-settings-block', 'user-settings-button'],
    ]],
    ['知识与提示词', [
        ['knowledge', '世界书与知识', 'book-open', '世界书、触发规则、扫描深度与知识注入', 'WorldInfo', 'WI-SP-button'],
        ['format', '提示词与格式', 'align-left', '上下文模板、系统提示词、推理解析与分隔符', 'AdvancedFormatting', 'advanced-formatting-button'],
    ]],
    ['扩展与管理', [
        ['extensions', '扩展与工具', 'puzzle-piece', '语音、图像、翻译、向量检索及已安装扩展', 'rm_extensions_block', 'extensions-settings-button'],
        ['data', '聊天与数据', 'folder-open', '聊天记录、导入导出、账户和恢复入口'],
    ]],
];
const pages = groups.flatMap(([,p])=>p);
const $ = (s) => document.querySelector(s);
let prefs, mounted, placeholder, lastFocus, activePage = 'quick', generating = false, openingNative = false;
const icon = n => `<i class="fa-solid fa-${n}" aria-hidden="true"></i>`;
function persist() { getContext().saveSettingsDebounced(); }
function apply() {
    document.body.classList.toggle('st-studio', !prefs.classic);
    document.body.classList.toggle('st-hide-thoughts', !prefs.showThoughts);
    document.body.classList.toggle('st-studio-background', prefs.background);
    document.body.dataset.studioDensity = prefs.density;
    $('#studio-return').hidden = !prefs.classic;
    applyAppearance();
}
function writeNative(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = value; else el.value = value;
    window.jQuery(el).trigger('input').trigger('change');
}
function restorePanel() {
    if (mounted && placeholder) {
        placeholder.replaceWith(mounted);
        mounted.classList.remove('studio-mounted');
        mounted.classList.remove('openDrawer'); mounted.classList.add('closedDrawer');
        mounted.style.display = 'none';
        const ico = mounted.parentElement.querySelector('.drawer-icon');
        ico?.classList.remove('openIcon'); ico?.classList.add('closedIcon');
    }
    mounted = placeholder = null;
}
function closeSettings() {
    restorePanel(); $('#studio-settings').hidden = true;
    lastFocus?.focus();
}
function openSettings(id = 'quick') {
    if ($('#studio-settings').hidden) lastFocus = document.activeElement;
    $('#studio-settings').hidden = false;
    $('#studio-nav').classList.remove('mobile-open');
    document.body.classList.remove('qq-list-open');
    showPage(id);
    $('#studio-close').focus();
}
function row(title, description, control) {
    return `<div class="studio-control"><div><strong>${title}</strong><p>${description}</p></div>${control}</div>`;
}
function showPage(id) {
    restorePanel(); activePage = id;
    const p = pages.find(p=>p[0]===id) || pages[0];
    $('#studio-settings-title').textContent = p[1];
    $('#studio-settings-desc').textContent = p[3];
    document.querySelectorAll('[data-page]').forEach(b=>{ b.classList.toggle('selected',b.dataset.page===id); b.setAttribute('aria-current',b.dataset.page===id?'page':'false'); });
    const host = $('#studio-settings-body'); host.replaceChildren();
    if (id === 'personalize') {
        renderPersonalization(host);
    } else if (id === 'quick') {
        host.innerHTML = `<div class="studio-notice">显示思考 ≠ 模型思考。隐藏思考只影响页面，不会把正式回答删掉。</div>
        <section class="studio-card"><h3>回答生成</h3>
        ${row('模型思考模式', '仅控制 DeepSeek 官方 API 的 thinking 参数；其他服务商请在采样设置中配置。', '<label class="studio-switch"><input aria-label="模型思考模式" type="checkbox" id="studio-thinking"><span></span></label>')}
        ${row('展示思考过程', '默认关闭。开关不会改变模型请求或正式答案。', '<label class="studio-switch"><input aria-label="展示思考过程" type="checkbox" id="studio-thoughts"><span></span></label>')}
        ${row('推理强度', '不是精确推理字数；只在模型支持且启用思考时生效。可用取值以服务商为准。', '<select aria-label="推理强度" id="studio-effort"><option value="auto">自动</option><option value="min">最小</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="max">最大</option></select>')}
        ${row('最大生成额度 · tokens', '不是字数。思考模型的推理和回答可能共用额度；启用思考时建议先用 8192。', '<input aria-label="最大生成额度" id="studio-tokens" type="number" min="1" max="128000" step="1">')}
        ${row('上下文窗口 · tokens', '发送给模型的历史与提示词预算。不要超过当前模型支持的上限。', '<input aria-label="上下文窗口" id="studio-context" type="number" min="512" max="2000000" step="512">')}
        ${row('流式输出', '逐步显示正式回答，而不是等到整段生成完毕。', '<label class="studio-switch"><input aria-label="流式输出" type="checkbox" id="studio-stream"><span></span></label>')}
        </section><section class="studio-card"><h3>阅读体验</h3>
        ${row('消息密度', '只改变页面排版，不裁切答案、不减少生成额度。', '<select aria-label="消息密度" id="studio-density"><option value="comfortable">舒适</option><option value="compact">紧凑</option></select>')}
        ${row('显示自选背景', '关闭时使用简洁阅读底色；图片仍保留在背景库中。', '<label class="studio-switch"><input aria-label="显示自选背景" type="checkbox" id="studio-background"><span></span></label>')}
        </section><p class="studio-footnote">所有修改自动保存。若旧消息已经为空，调整后需要重新生成，无法从不存在的正文恢复答案。API 额度不等于显示长度。</p>`;
        $('#studio-effort').value = oai_settings.reasoning_effort || 'auto';
        $('#studio-effort').onchange = e => writeNative('openai_reasoning_effort',e.target.value);
        $('#studio-thinking').checked = prefs.thinking;
        $('#studio-thoughts').checked = prefs.showThoughts;
        $('#studio-tokens').value = oai_settings.openai_max_tokens;
        $('#studio-context').value = oai_settings.openai_max_context;
        $('#studio-stream').checked = oai_settings.stream_openai;
        $('#studio-density').value = prefs.density;
        $('#studio-background').checked = prefs.background;
        $('#studio-thinking').onchange = e => { prefs.thinking=e.target.checked; persist(); updateHeader(); };
        $('#studio-thoughts').onchange = e => { prefs.showThoughts=e.target.checked; apply(); persist(); };
        $('#studio-stream').onchange = e => writeNative('stream_toggle',e.target.checked);
        for (const [name, native] of [['tokens','openai_max_tokens'],['context','openai_max_context']]) {
            $('#studio-'+name).onchange = e => { if (e.target.checkValidity()) writeNative(native, Number(e.target.value)); else e.target.reportValidity(); };
        }
        $('#studio-density').onchange=e=>{prefs.density=e.target.value;if(prefs.appearance)prefs.appearance.density=prefs.density;apply();persist();};
        $('#studio-background').onchange=e=>{prefs.background=e.target.checked;if(prefs.appearance)prefs.appearance.background=prefs.background;apply();persist();};
    } else if (id === 'data') {
        host.innerHTML = `<section class="studio-card"><h3>聊天与数据</h3><p>沿用原生的数据管理功能，不改写已有聊天或角色文件。</p><div class="studio-action-grid">
        <button data-action="history">${icon('clock-rotate-left')} 当前角色的聊天记录</button>
        <button data-action="characters">${icon('address-card')} 角色卡导入 / 导出</button>
        <button data-action="account">${icon('user-shield')} 账户与数据管理</button>
        <button data-action="classic">${icon('rotate-left')} 切换到原版界面</button></div></section>
        <div class="studio-notice">聊天记录窗口支持聊天文件管理；角色卡在角色管理中操作；主题和设置备份位于外观与交互。新界面不删除、不迁移这些数据。</div>`;
        host.querySelector('[data-action="history"]').onclick=()=>{closeSettings(); nativeAction('option_select_chat');};
        host.querySelector('[data-action="characters"]').onclick=()=>showPage('characters');
        host.querySelector('[data-action="account"]').onclick=()=>{closeSettings();nativeAction('account_button');};
        host.querySelector('[data-action="classic"]').onclick=()=>{closeSettings();prefs.classic=true;apply();persist();};
    } else {
        const panel=document.getElementById(p[4]);
        if (!panel) { host.textContent='此版本未提供这个面板，请使用原版界面。'; return; }
        // Invoke the original toggle before mounting, so lazy-loaded lists still initialize.
        const toggle=document.querySelector('#'+p[5]+' > .drawer-toggle');
        openingNative = true;
        try { if (!panel.classList.contains('openDrawer')) toggle?.click(); } finally { openingNative = false; }
        window.jQuery(panel).stop(true,true);
        placeholder=document.createComment('studio-panel-original-position');
        panel.before(placeholder); mounted=panel;
        panel.classList.add('studio-mounted'); host.append(panel);
    }
    host.scrollTop=0;
}
function nativeAction(id) {
    $('#studio-nav').classList.remove('mobile-open');
    const ctx=getContext();
    if (['option_select_chat','option_start_new_chat'].includes(id) && ctx.characterId===undefined && !ctx.groupId) { openSettings('characters'); return; }
    document.getElementById(id)?.click();
}
function updateHeader() {
    const ctx=getContext();
    $('#studio-chat-title').textContent = ctx.characterId!==undefined || ctx.groupId ? ctx.name2 || '当前对话' : '开始一段新对话';
    $('#studio-connection').textContent = ctx.onlineStatus && ctx.onlineStatus!=='no_connection' ? '已连接' : '检查连接';
    $('#studio-mode').textContent = generating ? '正在生成回答…' : prefs.thinking ? '思考模式' : '直接回答';
}
function markEmptyMessages() {
    const ctx=getContext();
    document.querySelectorAll('#chat .mes').forEach(el=>{
        const m=ctx.chat[Number(el.getAttribute('mesid'))];
        if (!m || m.is_user || m.is_system || m.mes?.trim() || m.extra?.tool_invocations?.length || m.extra?.image || m.extra?.media?.length) {el.querySelector('.studio-empty')?.remove();return;}
        if (el.querySelector('.studio-empty')) return;
        const note=document.createElement('div');note.className='studio-empty';
        note.textContent='这条消息没有正式回答。可能已达到生成额度或请求中断。请检查连接和生成额度，再使用消息菜单重新生成。';
        (el.querySelector('.mes_block')||el).append(note);
    });
}
function initialize() {
    if ($('#studio-nav')) return;
    prefs=extension_settings.studio_ui ||= {showThoughts:false,thinking:false,classic:false,density:'comfortable',background:false};
    if (!prefs.migrated) {
        // Repair the diagnosed 200-token budget without resetting other provider settings.
        if (oai_settings.openai_max_tokens < 4096) writeNative('openai_max_tokens',4096);
        prefs.migrated=true;persist();
    }
    document.body.insertAdjacentHTML('beforeend', `<aside id="studio-nav" aria-label="主导航">
        <div class="studio-brand"><span class="studio-brand-icon">S</span><div>QQ Studio<small>基于 SillyTavern · 个性对话</small></div></div>
        <button class="studio-new" id="studio-new">${icon('plus')} 新建对话</button>
        <div class="studio-nav-label">工作空间</div>
        <button id="studio-home" class="studio-nav-item selected">${icon('comment-dots')} 聊天</button>
        <button id="studio-history" class="studio-nav-item">${icon('clock-rotate-left')} 聊天记录</button>
        <button class="studio-nav-item" data-open="characters">${icon('address-card')} 角色与群聊</button>
        <button class="studio-nav-item" data-open="knowledge">${icon('book-open')} 知识与世界书</button>
        <button class="studio-nav-item" data-open="extensions">${icon('puzzle-piece')} 扩展与工具</button>
        <div class="studio-sidebar-note">专注对话，<br>其余的留在设置里。</div>
        <div class="studio-nav-bottom"><button class="studio-nav-item" data-open="quick">${icon('gear')} 设置 <span class="studio-key">⌘ ,</span></button><button class="studio-nav-item" data-open="api"><span class="studio-dot"></span><span id="studio-connection">检查连接</span>${icon('angle-right')}</button></div>
        </aside><header id="studio-header"><button id="studio-mobile-menu" aria-label="展开导航">${icon('bars')}</button><div><strong id="studio-chat-title">开始一段新对话</strong><small id="studio-mode">直接回答</small></div><button data-open="quick" aria-label="对话设置">${icon('sliders')} 对话设置</button></header>
        <button id="studio-return" hidden>返回新版界面</button>
        <div id="studio-settings" hidden><section role="dialog" aria-modal="true" aria-labelledby="studio-settings-title" class="studio-dialog">
        <aside class="studio-settings-nav"><div class="studio-settings-brand">设置<span>SETTINGS</span></div><input id="studio-search" aria-label="搜索设置" placeholder="搜索设置…">
        <nav>${groups.map(([label,items])=>`<div class="studio-settings-group"><div class="studio-nav-label">${label}</div>${items.map(p=>`<button data-page="${p[0]}" data-search="${p[1]} ${p[3]}">${icon(p[2])}${p[1]}</button>`).join('')}</div>`).join('')}</nav></aside>
        <main class="studio-settings-main"><header><div><h2 id="studio-settings-title"></h2><p id="studio-settings-desc"></p></div><button id="studio-close" aria-label="关闭设置">${icon('xmark')}</button></header><div id="studio-settings-body"></div></main></section></div>`);
    apply(); updateHeader();
    document.querySelectorAll('#top-settings-holder > .drawer > .drawer-toggle').forEach(toggle=>toggle.addEventListener('click',e=>{
        if (openingNative || prefs.classic) return;
        const page=pages.find(p=>p[5]===toggle.parentElement.id);
        if(page){e.preventDefault();e.stopImmediatePropagation();openSettings(page[0]);}
    },true));
    document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openSettings(b.dataset.open));
    document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
    $('#studio-new').onclick=()=>nativeAction('option_start_new_chat');
    $('#studio-history').onclick=()=>nativeAction('option_select_chat');
    $('#studio-home').onclick=()=>{closeSettings();$('#studio-nav').classList.remove('mobile-open');};
    $('#studio-mobile-menu').onclick=()=>$('#studio-nav').classList.toggle('mobile-open');
    $('#studio-close').onclick=closeSettings;
    $('#studio-settings').onclick=e=>{if(e.target.id==='studio-settings')closeSettings();};
    $('#studio-return').onclick=()=>{prefs.classic=false;apply();persist();};
    $('#studio-search').oninput=e=>{
        const q=e.target.value.toLowerCase();
        document.querySelectorAll('[data-search]').forEach(b=>b.hidden=!b.dataset.search.toLowerCase().includes(q));
        document.querySelectorAll('.studio-settings-group').forEach(g=>g.hidden=![...g.querySelectorAll('button')].some(b=>!b.hidden));
    };
    document.addEventListener('keydown',e=>{
        if ((e.metaKey||e.ctrlKey)&&e.key===',') {e.preventDefault();openSettings();}
        if(e.key==='Escape'&&!$('#studio-settings').hidden&&!document.querySelector('dialog[open]')){e.preventDefault();closeSettings();}
        if(e.key==='Tab'&&!$('#studio-settings').hidden&&!document.querySelector('dialog[open]')){
            const items=[...$('#studio-settings').querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(e=>e.getClientRects().length&&!e.disabled);
            const first=items[0],last=items.at(-1);
            if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
            if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
        }
    });
    eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY,request=>configureDeepSeek(request,prefs,yaml));
    eventSource.on(event_types.GENERATION_STARTED,(_type,_options,dryRun)=>{if(dryRun)return;generating=true;updateHeader();});
    eventSource.on(event_types.GENERATION_STOPPED,()=>{generating=false;updateHeader();});
    eventSource.on(event_types.GENERATION_ENDED,()=>{generating=false;updateHeader();markEmptyMessages();});
    for(const event of [event_types.CHAT_CHANGED,event_types.CHAT_LOADED,event_types.ONLINE_STATUS_CHANGED]) eventSource.on(event,()=>{updateHeader();markEmptyMessages();});
    initPersonalization({prefs,save:persist,openSettings,ctx:getContext,events:eventSource,eventTypes:event_types,isBusy:()=>generating});
    markEmptyMessages();
}
eventSource.on(event_types.APP_READY,initialize);
