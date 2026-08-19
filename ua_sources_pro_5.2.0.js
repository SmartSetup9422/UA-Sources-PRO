/*
 * UA Sources PRO 5.2.0
 * Ukrainian search sources for Lampa TV.
 * Search only: opens the selected public source page in Lampa Browser.
 */
(function () {
    'use strict';

    var VERSION = '5.2.0';
    var GUARD = 'ua_sources_pro_520_ready';
    var registered = false;
    var retry = null;
    var TIMEOUT = 15000;

    if (window[GUARD]) return;
    window[GUARD] = true;

    function safe(fn, fallback) {
        try { return fn(); } catch (e) { return fallback; }
    }

    function log() {
        safe(function () {
            console.log.apply(console, ['UA Sources PRO ' + VERSION].concat([].slice.call(arguments)));
        });
    }

    function clean(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function notify(text) {
        safe(function () {
            if (window.Lampa && Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(text);
        });
    }

    function absolute(base, value) {
        if (!value) return '';
        try { return new URL(value, base).href; }
        catch (e) {
            if (/^https?:\/\//i.test(value)) return value;
            return base.replace(/\/$/, '') + '/' + String(value).replace(/^\//, '');
        }
    }

    function attr(node, name) {
        return node && node.getAttribute ? (node.getAttribute(name) || '') : '';
    }

    /* These are the four sources used by the previous UA Sources PRO build. */
    var sites = [
        {
            id: 'uakino',
            title: 'UAKino 🇺🇦',
            base: 'https://uakino.com.ua/',
            search: function (q) {
                return this.base + 'index.php?do=search&subaction=search&story=' + encodeURIComponent(q);
            }
        },
        {
            id: 'uafilm',
            title: 'UAfilm 🇺🇦',
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
                return this.base + 'index.php?do=search&subaction=search&story=' + encodeURIComponent(q);
            }
        },
        {
            id: 'uafilm_org',
            title: 'UAFilm.org 🇺🇦',
            base: 'https://uafilm.org/',
            search: function (q) {
                return this.base + 'index.php?do=search&subaction=search&story=' + encodeURIComponent(q);
            }
        }
    ];

    function parse(html, site) {
        var doc;
        try {
            doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
        } catch (e) {
            return [];
        }

        var links = doc.querySelectorAll('a[href]');
        var result = [];
        var seen = {};

        for (var i = 0; i < links.length && result.length < 60; i++) {
            var a = links[i];
            var href = absolute(site.base, attr(a, 'href'));
            var title = clean(a.textContent || a.innerText || '');

            if (!href || href.indexOf(site.base) !== 0) continue;
            if (!title || title.length < 2 || title.length > 180) continue;
            if (/^(головна|категорії|категории|увійти|войти|реєстрація|регистрация|пошук|поиск|menu|login|register)$/i.test(title)) continue;
            if (/javascript:|#$/i.test(href)) continue;

            var card = null;
            try { card = a.closest('article, .item, .movie, .film, .shortstory, .card, .post, .th-item, .poster'); } catch (e) {}
            var text = clean(card ? card.textContent : title);
            var yearMatch = text.match(/\b(19|20)\d{2}\b/);
            var qualityMatch = text.match(/\b(2160p|1440p|1080p|720p|576p|480p|4K|WEB-DL|BDRip)\b/i);
            var poster = '';

            if (card) {
                var img = card.querySelector('img');
                if (img) poster = attr(img, 'data-src') || attr(img, 'data-lazy-src') || attr(img, 'data-original') || attr(img, 'src');
            }

            var key = title.toLowerCase() + '|' + href;
            if (seen[key]) continue;
            seen[key] = true;

            result.push({
                title: title,
                name: title,
                release_date: yearMatch ? yearMatch[0] : '',
                year: yearMatch ? yearMatch[0] : '',
                poster: absolute(site.base, poster),
                img: absolute(site.base, poster),
                quality: qualityMatch ? qualityMatch[1].toUpperCase() : '',
                audio: 'Українська',
                source: site.id,
                source_name: site.title,
                url: href,
                type: /серіал|сезон|season|episode/i.test(text) ? 'tv' : 'movie'
            });
        }

        return result;
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
            req.native(site.search(query), function (html) {
                finish(parse(html, site));
            }, function () {
                finish([]);
            }, false, { dataType: 'text', timeout: TIMEOUT });
        } catch (e) {
            log('request failed:', site.id, e);
            finish([]);
        }
    }

    function makeTest() {
        return [{
            title: 'UA Sources PRO — ТЕСТ ПІДКЛЮЧЕННЯ',
            name: 'UA Sources PRO — ТЕСТ ПІДКЛЮЧЕННЯ',
            release_date: '2026',
            year: '2026',
            source: 'ua_sources_pro_test',
            source_name: '🇺🇦 UA Sources PRO 5.2.0',
            audio: 'Українська',
            type: 'movie',
            url: 'https://uakino.com.ua/'
        }];
    }

    function makeSource() {
        return {
            title: '🇺🇦 UA Sources PRO',

            search: function (params, complete) {
                var query = clean(params && params.query);
                try { query = decodeURIComponent(query); } catch (e) {}
                if (!query) { complete([]); return; }

                if (query.toUpperCase() === 'UA-SOURCES-TEST') {
                    complete(makeTest());
                    return;
                }

                var pending = sites.length;
                var all = [];

                sites.forEach(function (site) {
                    request(site, query, function (items) {
                        if (items && items.length) all = all.concat(items);
                        pending--;
                        if (pending) return;

                        var seen = {};
                        var out = [];
                        all.forEach(function (item) {
                            var key = (item.title || '').toLowerCase() + '|' + (item.year || '') + '|' + (item.url || '');
                            if (!seen[key]) {
                                seen[key] = true;
                                out.push(item);
                            }
                        });
                        complete(out);
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
                    if (Lampa.Browser && Lampa.Browser.open) Lampa.Browser.open(item.url);
                });
            }
        };
    }

    function register() {
        if (registered) return true;
        if (!window.Lampa || !Lampa.Search || typeof Lampa.Search.addSource !== 'function') return false;

        try {
            Lampa.Search.addSource(makeSource());
            registered = true;
            window.ua_sources_pro_520_registered = true;
            log('REGISTERED');
            notify('🇺🇦 UA Sources PRO 5.2.0 підключено');
            return true;
        } catch (e) {
            log('REGISTER ERROR', e);
            return false;
        }
    }

    function startPlugin() {
        if (register()) return;

        if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) {
            safe(function () {
                Lampa.Listener.follow('app', function (event) {
                    if (event && event.type === 'ready') register();
                });
            });
        }

        if (retry) return;
        var tries = 0;
        retry = setInterval(function () {
            tries++;
            if (register() || tries >= 120) {
                clearInterval(retry);
                retry = null;
                if (!registered) log('Lampa.Search unavailable after 60 seconds');
            }
        }, 500);
    }

    /* Critical: actually start the plugin. */
    startPlugin();
})();
