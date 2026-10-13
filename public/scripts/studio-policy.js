// Pure request policy: display preferences never determine answer extraction.
export function isOfficialDeepSeek(request) {
    if (request.chat_completion_source === 'deepseek') return true;
    if (request.chat_completion_source !== 'custom') return false;
    try { return new URL(request.custom_url).hostname === 'api.deepseek.com'; } catch { return false; }
}
export function configureDeepSeek(request, prefs, yaml) {
    if (!isOfficialDeepSeek(request)) return;
    if (!prefs.thinking) delete request.reasoning_effort;
    if (request.chat_completion_source === 'deepseek') {
        request.include_reasoning = prefs.thinking;
    } else {
        const extra = yaml.parse(request.custom_include_body || '{}') || {};
        if (typeof extra !== 'object' || Array.isArray(extra)) throw new Error('自定义请求体必须是 YAML 对象');
        if (!prefs.thinking) delete extra.reasoning_effort;
        extra.thinking = { type: prefs.thinking ? 'enabled' : 'disabled' };
        request.custom_include_body = yaml.stringify(extra);
    }
}
