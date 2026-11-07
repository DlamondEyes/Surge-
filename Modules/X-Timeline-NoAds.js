/**
 * X timeline promoted-post filter for Surge (iOS).
 * Only modifies recognized timeline instruction entry lists.
 * No network requests, credentials collection, or external libraries.
 * If the payload is unrecognized, it passes through unchanged.
 */
(function () {
  'use strict';
  const body = $response && $response.body;
  if (typeof body !== 'string' || !/^\s*\{/.test(body)) {
    $done({});
    return;
  }

  function obj(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function promotedFlag(value) {
    return obj(value) && (
      value.promotedMetadata != null ||
      value.promoted_metadata != null ||
      value.promotionMetadata != null
    );
  }
  function promoted(entry) {
    if (!obj(entry)) return false;
    const id = String(entry.entryId || entry.entry_id || '');
    if (/(?:^|[-_])promoted(?:[-_]?tweet)?(?:[-_]|$)/i.test(id)) return true;
    const content = obj(entry.content) ? entry.content : {};
    const item = obj(entry.item) ? entry.item : {};
    const itemContent = content.itemContent || entry.itemContent || item.itemContent ||
      (item.content && item.content.itemContent);
    const result = itemContent && itemContent.tweet_results &&
      itemContent.tweet_results.result;
    return promotedFlag(entry) || promotedFlag(content) ||
      promotedFlag(item) || promotedFlag(itemContent) ||
      promotedFlag(result) || promotedFlag(result && result.tweet);
  }

  let removed = 0;
  function cleanEntry(entry) {
    if (!obj(entry)) return entry;
    const content = obj(entry.content) ? entry.content : null;
    const groups = [[entry, 'moduleItems'], [entry, 'items'],
      [content, 'items'], [content, 'moduleItems']];
    let emptied = false;
    for (const [owner, key] of groups) {
      if (!owner || !Array.isArray(owner[key]) || !owner[key].length) continue;
      const oldLength = owner[key].length;
      owner[key] = owner[key].filter(item => {
        if (promoted(item) || (item && promoted(item.item))) {
          removed++;
          return false;
        }
        return true;
      });
      if (oldLength && !owner[key].length) emptied = true;
    }
    return emptied ? null : entry;
  }
  function cleanEntries(entries) {
    if (!Array.isArray(entries)) return entries;
    return entries.filter(entry => {
      if (promoted(entry)) {
        removed++;
        return false;
      }
      return cleanEntry(entry) !== null;
    });
  }
  function cleanInstruction(inst) {
    if (!obj(inst)) return true;
    if (promoted(inst.entry) ||
      (obj(inst.replaceEntry) && promoted(inst.replaceEntry.entry))) {
      removed++;
      return false;
    }
    if (Array.isArray(inst.entries)) inst.entries = cleanEntries(inst.entries);
    if (obj(inst.addEntries) && Array.isArray(inst.addEntries.entries)) {
      inst.addEntries.entries = cleanEntries(inst.addEntries.entries);
    }
    if (Array.isArray(inst.moduleItems)) {
      inst.moduleItems = cleanEntries(inst.moduleItems);
    }
    if (obj(inst.addToModule) && Array.isArray(inst.addToModule.moduleItems)) {
      inst.addToModule.moduleItems = cleanEntries(inst.addToModule.moduleItems);
    }
    return true;
  }

  try {
    const data = JSON.parse(body);
    if (!obj(data)) { $done({}); return; }
    const seen = new WeakSet();
    const excluded = new Set(['globalObjects', 'tweet_results', 'tweetResult',
      'legacy', 'core', 'media', 'entities', 'extended_entities',
      'users', 'user_results', 'quoted_status_result',
      'retweeted_status_result', 'responseObjects', 'feedbackActions',
      'metadata', 'features', 'viewer', 'user_info']);
    let sets = 0, visited = 0;
    function walk(node, depth) {
      if (!obj(node) || depth > 9 || visited++ > 3500 || seen.has(node)) return;
      seen.add(node);
      if (Array.isArray(node.instructions)) {
        sets++;
        node.instructions = node.instructions.filter(cleanInstruction);
      }
      for (const key of Object.keys(node)) {
        if (key === 'instructions' || excluded.has(key)) continue;
        if (obj(node[key])) walk(node[key], depth + 1);
      }
    }
    walk(data, 0);
    if (removed > 0 && sets > 0) {
      console.log('[X Timeline NoAds] removed ' + removed + ' promoted entries');
      $done({ body: JSON.stringify(data) });
    } else {
      $done({});
    }
  } catch (e) {
    console.log('[X Timeline NoAds] untouched: ' + String(e));
    $done({});
  }
})();