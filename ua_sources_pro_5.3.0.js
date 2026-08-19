/*
 * UA Sources PRO 5.3.0 — bootstrap + source registration fix
 * Lampa 3.x+, ES5-compatible.
 * Search only: selecting a result opens the public source page.
 */
(function () {
    'use strict';

    var VERSION = '5.3.0';
    var READY = 'ua_sources_pro_530_registered';
    var BOOT = 'ua_sources_pro_530_bootstrap';
    var retryTimer = null;
    var registered = false;
    var TIMEOUT = 15000;

    function safe(fn, fallback) {
        try { return fn(); } catch (e) { return fallback; }
    }

    function log() {
        safe(function () {
            if (window.console && console.log) console.log.apply(console, ['UA Sources PRO ' + VERSION].concat([].slice.call(arguments)));
        });
    }

    function clean(v) {
        return String(v == null ? '' : v).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    }

    function absolute(base, value) {
        value = clean(value);
        if (!value) return '';
        if (/^https?:\/\//i.test(value)) return value;
        if (/^\/\//.test(value)) return location.protocol + value;
        return base.replace(/\/$/, '') + '/' + value.replace(/^\//, '');
    }

    function attr(node, name) {
        return node && node.getAttribute ? (node.getAttribute(name) || '') : '';
    }

    function notify(text) {
        safe(function () {
            if (window.Lampa && Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(text);
        });
    }

    /* These are the requested Ukrainian sources. */
    var sites = [
        {
            id: 'uakino',
            title: 'UAKino 🇺🇦',
            base: 'https://uakino.com.ua/',
            search: function (q) {
                return this.base + '?do=search&subaction=search&story=' + encodeURIComponent(q);
            }
        },
        {
            id: 'uakino_hd',
            title: 'UAKino HD 🇺🇦',
            base: 'https://uakino-hd.com/',
            search: function (q) {
                return this.base + '?do=search&subaction=search&story=' + encodeURIComponent(q);
            }
        },
        {
            id: 'uafilm',
            title: 'UAfilm.PRO 🇺🇦',
            base: 'https://uafilm.pro/',
            search: function (q) {
                return this.base + 'index.php?do=search&subaction=search&story=' + encodeURIComponent(q);
            }
        },
        {
            id: 'uaflix',
            title: 'UAFLIX 🇺🇦',
            base: 'https://uafix.net/',
            search: function (q) {
                return this.base + '?do=search&subaction=search&story=' + encodeURIComponent(q);
            }
        },
        {
            id: 'uafilm_org',
            title: 'UAFilm.org 🇺🇦',
            base: 'https://uafilm.org/',
            search: function (q) {
                return this.base + '?do=search&subaction=search&story=' + encodeURIComponent(q);
            }
        }
    ];

    function parse(html, site) {
        var doc;
        try {
            doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
        } catch (e) {
            log('parse error', site.id, e && e.message);
            return [];
        }

        var links = doc && doc.querySelectorAll ? doc.querySelectorAll('a[href]') : [];
        var out = [];
        var seen = {};

        for (var i = 0; i < links.length && out.length < 60; i++) {
            var a = links[i];
            var href = absolute(site.base, attr(a, 'href'));
            var title = clean(a.textContent || a.innerText || '');

            if (!href || !title || title.length < 2 || title.length > 180) continue;
            if (href.indexOf(site.base) !== 0) continue;
            if (/^(головна|категорії|категории|увійти|войти|реєстрація|регистрация|пошук|поиск|menu|login|register|далі|далее)$/i.test(title)) continue;
            if (/^(javascript:|#)/i.test(href)) continue;

            var parent = null;
            try {
                if (a.closest) parent = a.closest('article, .item, .movie, .film, .shortstory, .card, .post, .th-item, .poster');
            } catch (e) {}

            var body = clean(parent ? parent.textContent : title);
            var year = body.match(/\b(19|20)\d{2}\b/);
            var quality = body.match(/\b(2160p|1440p|1080p|720p|576p|480p|4K|WEB-DL|BDRip)\b/i);
            var poster = '';

            if (parent && parent.querySelector) {
                var img = parent.querySelector('img');
                if (img) {
                    poster = attr(img, 'data-src') || attr(img, 'data-lazy-src') || attr(img, 'data-original') || attr(img, 'src');
                }
            }

            var key = title.toLowerCase() + '|' + href;
            if (seen[key]) continue;
            seen[key] = true;

            out.push({
                title: title,
                name: title,
                url: href,
                poster: absolute(site.base, poster),
                img: absolute(site.base, poster),
                year: year ? year[0] : '',
                release_date: year ? year[0] : '0000',
                quality: quality ? quality[1].toUpperCase() : '',
                audio: 'Українська',
                source: site.id,
                source_name: site.title,
                type: /серіал|сезон|season|episode/i.test(body) ? 'tv' : 'movie'
            });
        }

        if (window.Lampa && Lampa.Utils && typeof Lampa.Utils.addSource === 'function') {
            return safe(function () { return Lampa.Utils.addSource(out, site.id); }, out);
        }
        return out;
    }

    function request(site, query, done) {
        var req = null;
        var finished = false;
        var timer = setTimeout(function () { finish([]); }, TIMEOUT);

        function finish(items) {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            safe(function () { if (req && req.clear) req.clear(); });
            done(items || []);
        }

        try {
            req = new Lampa.Reguest();
            if (req.timeout) safe(function () { req.timeout(TIMEOUT); });
            var url = site.search(query);
            req.native(url, function (html) {
                finish(parse(typeof html === 'string' ? html : '', site));
            }, function () {
                finish([]);
            }, false, { dataType: 'text' });
        } catch (e) {
            log('request error', site.id, e && e.message);
            finish([]);
        }
    }

    function testResult() {
        var data = [{
            title: 'UA Sources PRO — ТЕСТ ПРАЦЮЄ',
            name: 'UA Sources PRO — ТЕСТ ПРАЦЮЄ',
            release_date: '2026',
            year: '2026',
            source: 'ua_sources_pro',
            source_name: '🇺🇦 UA Sources PRO 5.3.0',
            url: 'https://uakino.com.ua/',
            type: 'movie',
            quality: 'TEST',
            audio: 'Українська'
        }];
        if (Lampa.Utils && typeof Lampa.Utils.addSource === 'function') {
            return safe(function () { return Lampa.Utils.addSource(data, 'ua_sources_pro'); }, data);
        }
        return data;
    }

    function makeSource() {
        return {
            title: '🇺🇦 UA Sources PRO',

            search: function (params, complete) {
                var query = clean(params && params.query);
                try { if (/%[0-9A-F]{2}/i.test(query)) query = decodeURIComponent(query); } catch (e) {}

                if (!query) { complete([]); return; }
                if (query.toUpperCase() === 'UA-SOURCES-TEST') {
                    complete(testResult());
                    return;
                }

                var pending = sites.length;
                var all = [];
                var done = false;

                function finish() {
                    if (done || pending) return;
                    done = true;
                    var seen = {};
                    var out = [];
                    all.forEach(function (item) {
                        var key = clean(item.title || item.name).toLowerCase() + '|' + (item.year || '') + '|' + (item.url || '');
                        if (!seen[key]) {
                            seen[key] = true;
                            out.push(item);
                        }
                    });
                    complete(out);
                }

                sites.forEach(function (site) {
                    request(site, query, function (items) {
                        if (items && items.length) all = all.concat(items);
                        pending--;
                        finish();
                    });
                });
            },

            onCancel: function () {},

            params: {
                lazy: true,
                align_left: true
            },

            onSelect: function (params, close) {
                var item = params && params.element;
                if (close) close();
                if (!item || !item.url) return;
                safe(function () {
                    if (Lampa.Browser && typeof Lampa.Browser.open === 'function') Lampa.Browser.open(item.url);
                    else if (window.open) window.open(item.url, '_blank');
                });
            }
        };
    }

    function register() {
        if (registered || window[READY]) return true;
        if (!window.Lampa || !Lampa.Search || typeof Lampa.Search.addSource !== 'function') return false;

        try {
            Lampa.Search.addSource(makeSource());
            registered = true;
            window[READY] = true;
            log('REGISTERED');
            notify('🇺🇦 UA Sources PRO 5.3.0 підключено');
            return true;
        } catch (e) {
            log('REGISTER ERROR', e && (e.stack || e.message));
            return false;
        }
    }

    function startPlugin() {
        if (registered || window[READY]) return;

        /* Lampa may not exist yet when the JS file is evaluated. */
        if (!window.Lampa) {
            setTimeout(startPlugin, 250);
            return;
        }

        if (register()) return;

        if (Lampa.Listener && typeof Lampa.Listener.follow === 'function' && !window[BOOT]) {
            window[BOOT] = true;
            safe(function () {
                Lampa.Listener.follow('app', function (event) {
                    if (event && event.type === 'ready') register();
                });
            });
        }

        if (!retryTimer) {
            var tries = 0;
            retryTimer = setInterval(function () {
                tries++;
                if (register() || tries >= 120) {
                    clearInterval(retryTimer);
                    retryTimer = null;
                    if (!registered) log('Search API unavailable after 60 seconds');
                }
            }, 500);
        }
    }

    /* Lampa's plugin loader calls the global startPlugin(). */
    window.startPlugin = startPlugin;

    /* Also start immediately when Lampa is already ready. */
    startPlugin();
})();
