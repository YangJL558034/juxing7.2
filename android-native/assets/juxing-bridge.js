(function () {
  if (window.__JUXING_ANDROID_BRIDGE_READY__) return;
  window.__JUXING_ANDROID_BRIDGE_READY__ = true;

  var queueKey = 'juxing_android_offline_queue_v1';
  var originalFetch = window.fetch ? window.fetch.bind(window) : null;

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value || '');
    } catch (error) {
      return fallback;
    }
  }

  function readQueue() {
    return safeJsonParse(window.localStorage.getItem(queueKey), []);
  }

  function writeQueue(queue) {
    window.localStorage.setItem(queueKey, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('juxing:offline-queue-change', { detail: { count: queue.length } }));
  }

  function notifyNative(title, body, tag) {
    try {
      if (window.JuxingAndroid && window.JuxingAndroid.notify) {
        window.JuxingAndroid.notify(String(title || '聚星'), String(body || ''), String(tag || 'system'));
      }
    } catch (error) {
      // The Android bridge is best-effort and should never break the web page.
    }
  }

  function serializableHeaders(headers) {
    var result = {};
    if (!headers) return result;

    try {
      if (headers.forEach) {
        headers.forEach(function (value, key) {
          result[key] = value;
        });
        return result;
      }

      Object.keys(headers).forEach(function (key) {
        var value = headers[key];
        if (typeof value === 'string') result[key] = value;
      });
    } catch (error) {
      return {};
    }
    return result;
  }

  function requestToRecord(input, init) {
    var url = typeof input === 'string' ? input : input && input.url;
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var headers = serializableHeaders((init && init.headers) || (input && input.headers));
    var body = init && init.body;

    if (!url || method === 'GET' || method === 'HEAD') return null;
    if (body && typeof body !== 'string') return null;

    return {
      id: Date.now() + '-' + Math.random().toString(36).slice(2),
      url: url,
      method: method,
      headers: headers,
      body: body || null,
      credentials: (init && init.credentials) || 'include',
      createdAt: new Date().toISOString()
    };
  }

  function enqueue(record) {
    var queue = readQueue();
    queue.push(record);
    writeQueue(queue);
    notifyNative('聚星离线同步', '网络离线，操作已加入同步队列', 'offline-sync');
  }

  window.juxingFlushOfflineQueue = async function () {
    if (!originalFetch || !navigator.onLine) return { synced: 0, remaining: readQueue().length };

    var queue = readQueue();
    var synced = 0;
    var remaining = [];

    for (var i = 0; i < queue.length; i += 1) {
      var item = queue[i];
      try {
        var response = await originalFetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
          credentials: item.credentials || 'include'
        });
        if (!response.ok) {
          remaining.push(item);
        } else {
          synced += 1;
        }
      } catch (error) {
        remaining.push(item);
      }
    }

    writeQueue(remaining);
    if (synced > 0) {
      notifyNative('聚星同步完成', '已同步 ' + synced + ' 条离线操作', 'offline-sync');
    }
    return { synced: synced, remaining: remaining.length };
  };

  if (originalFetch) {
    window.fetch = async function (input, init) {
      var record = requestToRecord(input, init || {});
      if (record && !navigator.onLine) {
        enqueue(record);
        return new Response(JSON.stringify({
          success: false,
          offlineQueued: true,
          message: '网络离线，操作已加入同步队列'
        }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        return await originalFetch(input, init);
      } catch (error) {
        if (record && !navigator.onLine) {
          enqueue(record);
          return new Response(JSON.stringify({
            success: false,
            offlineQueued: true,
            message: '网络离线，操作已加入同步队列'
          }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        throw error;
      }
    };
  }

  window.addEventListener('online', function () {
    window.juxingFlushOfflineQueue();
  });

  if (navigator.onLine) {
    window.juxingFlushOfflineQueue();
  }
})();
