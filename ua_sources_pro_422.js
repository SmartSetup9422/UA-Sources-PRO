// ==UserScript==
// @name        🇺🇦 UA Sources PRO
// @namespace   ua-sources-pro
// @version     4.2.2
// @description Українські джерела для Lampa TV — пошук через Lampa.Search
// @author      SmartSetup9422
// @grant       none
// ==/UserScript==

(function () {
    'use strict';

    /*
     * 4.2.0:
     * - new unique guard so an older 4.1.x build cannot block this build
     * - registers only after Lampa.Search is actually available
     * - uses the Lampa Search API shape used by current Lampa
     * - Lampa already encodeURIComponent()s params.query before calling source.search(),
     *   therefore we decode it once instead of double-encoding it
     * - UA-SOURCES-TEST is a deterministic registration test
     */

    if (window.ua_sources_pro_422_loaded) return;
    window.ua_sources_pro_422_loaded = true;

    var VERSION = '4.2.1';
    var CACHE = 'ua_sources_pro_422_cache';
    var REQUEST_TIMEOUT = 15000;
    var sources = [];
    var registered = false;
    var retryTimer = null;

    function safe(fn, fallback) {
        try { return fn(); } catch (e) { return fallback; }
    }

    function notify(text) {
        safe(function () {
            if (window.Lampa && Lampa.Noty && Lampa.Noty.show) {
                Lampa.Noty.show(text);
            }
        });
    }

    function log() {
        safe(function () {
            if (window.console && console.log) {
                console.log.apply(console, ['UA Sources PRO 4.2.2'].concat([].slice.call(arguments)));
            }
        });
    }

    function cleanText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function decodeQuery(value) {
        value = String(value || '');
        try {
            return decodeURIComponent(value);
        } catch (e) {
            return value;
        }
    }

    function absUrl(base, href) {
        if (!href) return '';
        try { return new URL(href, base).href; }
        catch (e) { return href; }
    }

    function attr(node, name) {
        return node && node.getAttribute ? (node.getAttribute(name) || '') : '';
    }

    function cacheGet(key) {
        return safe(function () {
            var all = Lampa.Storage.get(CACHE, {});
            var item = all && all[key];
            if (!item) return null;
            if (Date.now() - item.time > 5 * 60 * 1000) return null;
            return item.data;
        }, null);
    }

    function cacheSet(key, value) {
        safe(function () {
            var all = Lampa.Storage.get(CACHE, {});
            all = all && typeof all === 'object' ? all : {};
            all[key] = { time: Date.now(), data: value };
            Lampa.Storage.set(CACHE, all);
        });
    }

    function parseHtml(html, source) {
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
            var href = absUrl(source.base, attr(a, 'href'));
            var title = cleanText(a.textContent || a.innerText || '');

            if (!href || href.indexOf(source.base) !== 0) continue;
            if (!title || title.length < 2 || title.length > 180) continue;

            var card = a.closest ? a.closest('article, .item, .movie, .film, .shortstory, .card, .post, .th-item') : null;
            var cardText = cleanText(card ? card.textContent : title);

            var year = '';
            var yearMatch = cardText.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) year = yearMatch[0];

            var quality = '';
            var qualityMatch = cardText.match(/\b(2160p|1440p|1080p|720p|576p|480p)\b/i);
            if (qualityMatch) quality = qualityMatch[1].toUpperCase();

            var poster = '';
            if (card) {
                var img = card.querySelector('img');
                if (img) {
                    poster = attr(img, 'data-src') ||
                             attr(img, 'data-lazy-src') ||
                             attr(img, 'data-original') ||
                             attr(img, 'src');
                }
            }

            var key = title.toLowerCase() + '|' + href;
            if (seen[key]) continue;
            seen[key] = true;

            result.push({
                title: title,
                name: title,
                release_date: year || '0000',
                year: year,
                poster: absUrl(source.base, poster),
                img: absUrl(source.base, poster),
                quality: quality,
                audio: 'Українська',
                source: source.id,
                source_name: source.title,
                url: href,
                type: /серіал|сезон|season|episode/i.test(cardText) ? 'tv' : 'movie'
            });
        }

        return result;
    }

    function request(source, query, done) {
        var key = source.id + ':' + query.toLowerCase();
        var cached = cacheGet(key);

        if (cached) {
            done(cached);
            return;
        }

        var network = null;
        var finished = false;
        var timer = setTimeout(function () {
            finish([]);
        }, REQUEST_TIMEOUT);

        function finish(list) {
            if (finished) return;
            finished = true;
            clearTimeout(timer);

            safe(function () {
                if (network && network.clear) network.clear();
            });

            list = list || [];
            cacheSet(key, list);
            done(list);
        }

        try {
            network = new Lampa.Reguest();
            var url = source.searchUrl(query);

            function success(html) {
                finish(parseHtml(html, source));
            }

            function error() {
                finish([]);
            }

            if (network.native) {
                network.native(url, success, error, false, { dataType: 'text' });
            } else if (network.silent) {
                network.silent(url, success, error, false, { dataType: 'text' });
            } else {
                finish([]);
            }
        } catch (e) {
            log('request error', source.id, e);
            finish([]);
        }
    }

    function addSource(source) {
        sources.push(source);
    }

    addSource({
        id: 'uakino',
        title: 'UAKino 🇺🇦',
        base: 'https://uakino.com.ua/',
        searchUrl: function (q) {
            return this.base + 'index.php?do=search&subaction=search&story=' + encodeURIComponent(q);
        }
    });

    addSource({
        id: 'uafilm',
        title: 'UAfilm 🇺🇦',
        base: 'https://uafilm.pro/',
        searchUrl: function (q) {
            return this.base + 'index.php?do=search&subaction=search&story=' + encodeURIComponent(q);
        }
    });

    addSource({
        id: 'uaflix',
        title: 'UAFLIX 🇺🇦',
        base: 'https://uafix.net/',
        searchUrl: function (q) {
            return this.base + 'index.php?do=search&subaction=search&story=' + encodeURIComponent(q);
        }
    });

    addSource({
        id: 'uafilm_org',
        title: 'UAFilm.org 🇺🇦',
        base: 'https://uafilm.org/',
        searchUrl: function (q) {
            return this.base + 'index.php?do=search&subaction=search&story=' + encodeURIComponent(q);
        }
    });

    function testResult() {
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
            source_name: 'UA Sources PRO 4.2.2',
            url: 'https://github.com/SmartSetup9422/UA-Sources-PRO',
            type: 'movie'
        }];
    }

    function makeSource() {
        return {
            title: '🇺🇦 UA Sources PRO',

            search: function (params, oncomplete) {
                var query = decodeQuery(params && params.query ? params.query : '');

                if (!query) {
                    oncomplete([]);
                    return;
                }

                if (query.trim().toUpperCase() === 'UA-SOURCES-TEST') {
                    oncomplete([{
                        title: '🇺🇦 UA Sources PRO',
                        results: testResult()
                    }]);
                    return;
                }

                var pending = sources.length;
                var all = [];

                if (!pending) {
                    oncomplete([]);
                    return;
                }

                sources.forEach(function (source) {
                    request(source, query, function (items) {
                        if (items && items.length) {
                            all = all.concat(items);
                        }

                        pending--;

                        if (pending !== 0) return;

                        var unique = {};
                        var clean = [];

                        all.forEach(function (item) {
                            var key = (item.title || item.name || '').toLowerCase() +
                                      '|' + (item.year || '') +
                                      '|' + (item.url || '');

                            if (!unique[key]) {
                                unique[key] = true;
                                clean.push(item);
                            }
                        });

                        oncomplete(clean.length ? [{
                            title: '🇺🇦 Українські джерела',
                            results: clean
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
                card_events: {
                    onMenu: function () {}
                }
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

        if (!window.Lampa || !Lampa.Search ||
            typeof Lampa.Search.addSource !== 'function') {
            return false;
        }

        try {
            var source = makeSource();
            Lampa.Search.addSource(source);
            window.ua_sources_pro_422_source = source;
            registered = true;
            window.ua_sources_pro_422_registered = true;
            log('registered 4.2.2');
            notify('🇺🇦 UA Sources PRO 4.2.2 підключено');
            return true;
        } catch (e) {
            log('register error', e);
            return false;
        }
    }

    function start() {
        if (register()) return;

        // На актуальній Lampa безпечніше реєструвати пошукове джерело
        // після повної ініціалізації Search.
        if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) {
            Lampa.Listener.follow('app', function (e) {
                if (e && e.type === 'ready') register();
            });
        }

        if (retryTimer) return;

        var tries = 0;
        retryTimer = setInterval(function () {
            tries++;

            if (register() || tries >= 120) {
                clearInterval(retryTimer);
                retryTimer = null;

                if (!registered) {
                    notify('UA Sources PRO: Lampa.Search не доступний');
                    log('Lampa.Search unavailable after retry');
                }
            }
        }, 500);
    }

    function boot() {
        start();
    }

    boot();
})();
