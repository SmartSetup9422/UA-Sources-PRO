// ==UserScript==
// @name        🇺🇦 UA Sources PRO
// @namespace   ua-sources-pro
// @version     4.1.1
// @description Українські джерела для Lampa TV — пошук через Lampa.Search
// @author      SmartSetup9422
// @grant       none
// ==/UserScript==

(function () {
    'use strict';

    if (window.ua_sources_pro_411) return;
    window.ua_sources_pro_411 = true;

    var VERSION = '4.1.1';
    var CACHE = 'ua_sources_pro_411_cache';
    var REQUEST_TIMEOUT = 12000;
    var sources = [];
    var registered = false;
    var retryTimer = null;
    var retryCount = 0;

    function safe(fn, fallback) {
        try { return fn(); } catch (e) { return fallback; }
    }

    function notify(text) {
        safe(function () {
            if (window.Lampa && Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(text);
        });
    }

    function cleanText(value) {
        return String(value || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    }

    function absUrl(base, href) {
        try { return new URL(href, base).href; } catch (e) { return href || ''; }
    }

    function attr(node, name) {
        return node && node.getAttribute ? (node.getAttribute(name) || '') : '';
    }

    function cacheGet(key) {
        return safe(function () {
            var all = Lampa.Storage.get(CACHE, {});
            if (!all[key]) return null;
            if (Date.now() - all[key].time > 5 * 60 * 1000) return null;
            return all[key].data;
        }, null);
    }

    function cacheSet(key, data) {
        safe(function () {
            var all = Lampa.Storage.get(CACHE, {});
            all[key] = { time: Date.now(), data: data };
            Lampa.Storage.set(CACHE, all);
        });
    }

    function parseHtml(html, source) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var links = doc.querySelectorAll('a[href]');
        var result = [];
        var seen = {};

        for (var i = 0; i < links.length; i++) {
            var a = links[i];
            var href = absUrl(source.base, attr(a, 'href'));
            var title = cleanText(a.textContent || a.innerText || '');

            if (!href || href.indexOf(source.base) !== 0) continue;
            if (!title || title.length < 2 || title.length > 180) continue;

            var card = a.closest ? a.closest('article, .item, .movie, .film, .shortstory, .card, .post, .th-item') : null;
            var cardText = card ? cleanText(card.textContent || '') : title;

            var year = '';
            var yearMatch = cardText.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) year = yearMatch[0];

            var quality = '';
            var qualityMatch = cardText.match(/\b(2160p|1440p|1080p|720p|576p|480p)\b/i);
            if (qualityMatch) quality = qualityMatch[1].toUpperCase();

            var poster = '';
            if (card) {
                var img = card.querySelector('img');
                if (img) poster = attr(img, 'data-src') || attr(img, 'data-lazy-src') || attr(img, 'src');
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

            if (result.length >= 40) break;
        }

        return result;
    }

    function request(source, query, done) {
        var key = source.id + ':' + query.toLowerCase();
        var cached = cacheGet(key);
        if (cached) { done(cached); return; }

        var network;
        var finished = false;
        var timer = setTimeout(function () { finish([]); }, REQUEST_TIMEOUT);

        function finish(list) {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            safe(function () { if (network && network.clear) network.clear(); });
            cacheSet(key, list || []);
            done(list || []);
        }

        try {
            network = new Lampa.Reguest();
            var url = source.searchUrl(query);

            var callback = function (html) {
                var list = [];
                try { list = parseHtml(typeof html === 'string' ? html : '', source); } catch (e) {}
                finish(list);
            };

            if (network.native) {
                network.native(url, callback, function () { finish([]); }, false, { dataType: 'text' });
            } else if (network.silent) {
                network.silent(url, callback, function () { finish([]); }, false, { dataType: 'text' });
            } else {
                finish([]);
            }
        } catch (e) {
            finish([]);
        }
    }

    function addSource(source) { sources.push(source); }

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
            title: '🇺🇦 UA Sources PRO — тест джерела',
            name: 'UA Sources PRO — тест джерела',
            release_date: '0000',
            year: '',
            poster: '',
            img: '',
            quality: '',
            audio: 'Українська',
            source: 'ua_sources_pro_test',
            source_name: 'UA Sources PRO 4.1.1',
            url: 'https://github.com/SmartSetup9422/UA-Sources-PRO',
            type: 'movie'
        }];
    }

    function addLampaSearchSource() {
        if (registered) return true;
        if (!window.Lampa || !Lampa.Search || typeof Lampa.Search.addSource !== 'function') return false;

        var source = {
            title: '🇺🇦 UA Sources PRO',

            search: function (params, oncomplete) {
                var query = params && params.query ? String(params.query) : '';

                if (!query) { oncomplete([]); return; }

                if (query.trim().toUpperCase() === 'UA-SOURCES-TEST') {
                    oncomplete([{
                        title: '🇺🇦 UA Sources PRO',
                        results: testResult()
                    }]);
                    return;
                }

                var pending = sources.length;
                var all = [];

                if (!pending) { oncomplete([]); return; }

                sources.forEach(function (item) {
                    request(item, query, function (results) {
                        if (results && results.length) all = all.concat(results);
                        pending--;

                        if (pending === 0) {
                            var unique = {};
                            var clean = [];

                            all.forEach(function (card) {
                                var key = (card.title || card.name || '').toLowerCase() + '|' + (card.year || '');
                                if (!unique[key]) {
                                    unique[key] = true;
                                    clean.push(card);
                                }
                            });

                            oncomplete(clean.length ? [{
                                title: '🇺🇦 Українські джерела',
                                results: clean
                            }] : []);
                        }
                    });
                });
            },

            onCancel: function () {},

            params: {
                lazy: true,
                align_left: true,
                card_events: { onMenu: function () {} }
            },

            onMore: function (params, close) {
                if (close) close();
            },

            onSelect: function (params, close) {
                if (close) close();
                var element = params && params.element;
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

        try {
            Lampa.Search.addSource(source);
            registered = true;
            window.ua_sources_pro_411_search_registered = true;
            return true;
        } catch (e) {
            registered = false;
            return false;
        }
    }

    function installManifest() {
        safe(function () {
            if (!window.Lampa) return;
            Lampa.Manifest = Lampa.Manifest || {};
            Lampa.Manifest.plugins = Lampa.Manifest.plugins || {};
            Lampa.Manifest.plugins.ua_sources_pro_411 = {
                type: 'plugin',
                version: VERSION,
                name: '🇺🇦 UA Sources PRO',
                description: 'Пошук українських джерел через Lampa.Search',
                component: 'ua_sources_pro_411'
            };
        });
    }

    function tryStart() {
        if (registered) return true;
        if (addLampaSearchSource()) {
            installManifest();
            notify('🇺🇦 UA Sources PRO 4.1.1 активовано');
            if (retryTimer) clearInterval(retryTimer);
            retryTimer = null;
            return true;
        }
        return false;
    }

    function start() {
        if (registered) return;
        installManifest();
        tryStart();

        if (!registered && !retryTimer) {
            retryCount = 0;
            retryTimer = setInterval(function () {
                retryCount++;
                if (tryStart() || retryCount >= 40) {
                    clearInterval(retryTimer);
                    retryTimer = null;
                    if (!registered) notify('UA Sources PRO: Lampa.Search не знайдено');
                }
            }, 500);
        }
    }

    if (window.appready) {
        start();
    } else if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') start();
        });
        setTimeout(start, 2000);
    } else {
        setTimeout(start, 1000);
    }
})();
