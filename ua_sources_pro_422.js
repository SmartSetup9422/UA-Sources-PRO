// ==UserScript==
// @name        🇺🇦 UA Sources PRO
// @namespace   ua-sources-pro
// @version     4.3.0
// @description Українські джерела для Lampa TV — пошук через Lampa.Search
// @author      SmartSetup9422
// @grant       none
// ==/UserScript==

(function () {
    'use strict';

    var VERSION = '4.3.0';
    var GUARD = 'ua_sources_pro_430_ready';
    var CACHE = 'ua_sources_pro_430_cache';
    var TIMEOUT = 15000;
    var registered = false;
    var retry = null;

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

    function notify(text) {
        safe(function () {
            if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(text);
        });
    }

    function clean(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function decodeQuery(value) {
        value = String(value || '');
        try { return decodeURIComponent(value); }
        catch (e) { return value; }
    }

    function absolute(base, value) {
        if (!value) return '';
        try { return new URL(value, base).href; }
        catch (e) { return value; }
    }

    function attr(node, name) {
        return node && node.getAttribute ? (node.getAttribute(name) || '') : '';
    }

    function cacheGet(key) {
        return safe(function () {
            var all = Lampa.Storage.get(CACHE, {});
            var item = all && all[key];
            if (!item || Date.now() - item.time > 5 * 60 * 1000) return null;
            return item.data;
        }, null);
    }

    function cacheSet(key, data) {
        safe(function () {
            var all = Lampa.Storage.get(CACHE, {});
            if (!all || typeof all !== 'object') all = {};
            all[key] = { time: Date.now(), data: data };
            Lampa.Storage.set(CACHE, all);
        });
    }

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

        for (var i = 0; i < links.length && result.length < 40; i++) {
            var a = links[i];
            var href = absolute(site.base, attr(a, 'href'));
            var title = clean(a.textContent || a.innerText || '');

            if (!href || href.indexOf(site.base) !== 0) continue;
            if (!title || title.length < 2 || title.length > 180) continue;
            if (/^(головна|категорії|увійти|реєстрація|пошук|menu|login|register)$/i.test(title)) continue;

            var card = a.closest ? a.closest('article, .item, .movie, .film, .shortstory, .card, .post, .th-item') : null;
            var text = clean(card ? card.textContent : title);
            var yearMatch = text.match(/\b(19|20)\d{2}\b/);
            var qualityMatch = text.match(/\b(2160p|1440p|1080p|720p|576p|480p)\b/i);
            var poster = '';

            if (card) {
                var img = card.querySelector('img');
                if (img) {
                    poster = attr(img, 'data-src') || attr(img, 'data-lazy-src') || attr(img, 'data-original') || attr(img, 'src');
                }
            }

            var key = title.toLowerCase() + '|' + href;
            if (seen[key]) continue;
            seen[key] = true;

            result.push({
                title: title,
                name: /серіал|сезон|season|episode/i.test(text) ? title : undefined,
                release_date: yearMatch ? yearMatch[0] : '0000',
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
        var key = site.id + ':' + query.toLowerCase();
        var cached = cacheGet(key);
        if (cached) return done(cached);

        var req = null;
        var finished = false;
        var timer = setTimeout(function () { finish([]); }, TIMEOUT);

        function finish(items) {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            safe(function () { if (req && req.clear) req.clear(); });
            items = items || [];
            cacheSet(key, items);
            done(items);
        }

        try {
            req = new Lampa.Reguest();
            var url = site.search(query);

            req.native(url, function (html) {
                finish(parse(html, site));
            }, function () {
                finish([]);
            }, false, { dataType: 'text', timeout: TIMEOUT });
        } catch (e) {
            log('request failed', site.id, e);
            finish([]);
        }
    }

    function testItems() {
        return [{
            title: '🇺🇦 UA Sources PRO — ТЕСТ ПРАЦЮЄ',
            name: 'UA Sources PRO — ТЕСТ ПРАЦЮЄ',
            release_date: '2026',
            year: '2026',
            poster: '',
            img: '',
            quality: 'TEST',
            audio: 'Українська',
            source: 'ua_sources_pro_test',
            source_name: 'UA Sources PRO ' + VERSION,
            url: 'https://github.com/SmartSetup9422/UA-Sources-PRO',
            type: 'movie'
        }];
    }

    function makeSource() {
        return {
            title: '🇺🇦 UA Sources PRO',
            search: function (params, complete) {
                var query = decodeQuery(params && params.query);

                if (!query) {
                    complete([]);
                    return;
                }

                if (query.trim().toUpperCase() === 'UA-SOURCES-TEST') {
                    complete([{ title: '🇺🇦 UA Sources PRO', results: testItems() }]);
                    return;
                }

                var pending = sites.length;
                var all = [];

                sites.forEach(function (site) {
                    request(site, query, function (items) {
                        if (items && items.length) all = all.concat(items);
                        pending--;

                        if (pending) return;

                        var map = {};
                        var cleanItems = [];

                        all.forEach(function (item) {
                            var key = (item.title || '').toLowerCase() + '|' + (item.year || '') + '|' + (item.url || '');
                            if (!map[key]) {
                                map[key] = true;
                                cleanItems.push(item);
                            }
                        });

                        complete(cleanItems.length ? [{
                            title: '🇺🇦 Українські джерела',
                            results: cleanItems
                        }] : []);
                    });
                });
            },
            onCancel: function () {},
            params: {
                lazy: true,
                align_left: true,
                card_view: 6,
                noimage: true,
                nofound: 'search_nofound'
            },
            onMore: function (params, close) {
                if (close) close();
            },
            onSelect: function (params, close) {
                var element = params && params.element;
                if (close) close();
                if (!element || !element.url) return;

                safe(function () {
                    if (Lampa.Browser && Lampa.Browser.open) {
                        Lampa.Browser.open(element.url);
                    } else if (Lampa.Activity && Lampa.Activity.push) {
                        Lampa.Activity.push({
                            url: element.url,
                            title: element.title || 'UA Sources PRO',
                            component: 'browser'
                        });
                    }
                });
            }
        };
    }

    function register() {
        if (registered) return true;

        if (!window.Lampa || !Lampa.Search || typeof Lampa.Search.addSource !== 'function') {
            return false;
        }

        try {
            var source = makeSource();
            Lampa.Search.addSource(source);
            window.ua_sources_pro_430_source = source;
            window.ua_sources_pro_430_registered = true;
            registered = true;
            log('REGISTERED');
            notify('🇺🇦 UA Sources PRO 4.3.0 підключено');
            return true;
        } catch (e) {
            log('REGISTER ERROR', e);
            return false;
        }
    }

    function startPlugin() {
        if (register()) return;

        if (window.appready && register()) return;

        if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) {
            Lampa.Listener.follow('app', function (event) {
                if (event && event.type === 'ready') register();
            });
        }

        if (retry) return;
        var tries = 0;
        retry = setInterval(function () {
            tries++;
            if (register() || tries >= 120) {
                clearInterval(retry);
                retry = null;
                if (!registered) {
                    log('Lampa.Search unavailable after 60 seconds');
                    notify('UA Sources PRO: не вдалося підключити Lampa.Search');
                }
            }
        }, 500);
    }

    if (!window.ua_sources_pro_430_plugin) {
        window.ua_sources_pro_430_plugin = true;
        startPlugin();
    }
})();
