// ==UserScript==
// @name        🇺🇦 UA Sources PRO
// @namespace   ua-sources-pro
// @version     3.0.1
// @description Українські джерела для Lampa TV
// @author      SmartSetup9422
// @grant       none
// ==/UserScript==(function () {
    'use strict';

    /*
     * UA Sources PRO 3.0.0
     *
     * Production-safe autonomous architecture for Lampa.
     * This build intentionally does NOT scrape or bypass protected/paid
     * third-party movie services. It supports legal/public HLS/MP4 entries
     * supplied by an adapter and routes playable URLs to Lampa.Player.
     *
     * Add a source adapter by implementing:
     *   search(query, done)
     * where every result may contain:
     *   title, year, poster, source, audio, quality, url
     *
     * Only public/authorized streams should be returned by adapters.
     */

    if (window.ua_sources_pro_300) return;
    window.ua_sources_pro_300 = true;

    var VERSION = '3.0.1';
    var adapters = [];
    var CACHE = 'ua_sources_pro_300_cache';
    var TTL = 5 * 60 * 1000;

    function addAdapter(adapter) {
        if (!adapter || !adapter.id || !adapter.search) return;
        adapters.push(adapter);
    }

    function cacheGet(key) {
        try {
            var all = Lampa.Storage.get(CACHE, {});
            if (all[key] && Date.now() - all[key].time < TTL) return all[key].data;
        } catch (e) {}
        return null;
    }

    function cacheSet(key, data) {
        try {
            var all = Lampa.Storage.get(CACHE, {});
            all[key] = { time: Date.now(), data: data };
            Lampa.Storage.set(CACHE, all);
        } catch (e) {}
    }

    function notify(text) {
        try {
            if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(text);
        } catch (e) {}
    }

    function normalize(item, adapter) {
        return {
            title: item.title || item.name || 'Без назви',
            original_title: item.original_title || item.title || item.name || '',
            year: item.year || '',
            poster: item.poster || '',
            source: item.source || adapter.title || adapter.id,
            source_id: adapter.id,
            audio: item.audio || 'Українська',
            quality: item.quality || '',
            url: item.url || '',
            type: item.type || 'movie',
            season: item.season || 0,
            episode: item.episode || 0,
            playable: !!item.url
        };
    }

    function play(item) {
        if (!item || !item.url) {
            notify('Для цього результату немає доступного потоку');
            return;
        }

        var media = {
            url: item.url,
            title: item.title,
            quality: item.quality || '',
            timeline: 0,
            poster: item.poster || '',
            translate: item.audio || 'Українська'
        };

        try {
            Lampa.Player.play(media);
        } catch (e) {
            try {
                Lampa.Activity.push({
                    component: 'player',
                    url: item.url,
                    title: item.title,
                    movie: item
                });
            } catch (ignore) {
                notify('Lampa не змогла запустити потік');
            }
        }
    }

    function openResults(items, query) {
        var groups = {};
        var result = [];

        items.forEach(function (x) {
            var key = [
                String(x.title || '').toLowerCase(),
                String(x.year || ''),
                String(x.audio || '').toLowerCase(),
                String(x.quality || '').toLowerCase(),
                String(x.url || '')
            ].join('|');

            if (!groups[key]) {
                groups[key] = true;
                result.push(x);
            }
        });

        if (!result.length) {
            notify('Українських доступних джерел не знайдено');
            return;
        }

        /*
         * A compact native Activity is used instead of depending on private
         * Lampa templates. Selecting an item invokes Lampa.Player directly.
         */
        Lampa.Activity.push({
            title: '🇺🇦 Українські озвучки',
            component: 'ua_sources_pro_300_results',
            page: 1,
            search: query,
            items: result
        });
    }

    function component(object) {
        var html = $('<div class="ua-sources-pro-results"></div>');

        (object.items || []).forEach(function (item) {
            var row = $(
                '<div class="selector ua-source-row">' +
                    '<div class="selector__head">' + escapeHtml(item.title) + '</div>' +
                    '<div class="selector__text">' +
                        escapeHtml(item.source) + ' • ' +
                        escapeHtml(item.audio) + ' • ' +
                        escapeHtml(item.quality || 'Auto') +
                    '</div>' +
                '</div>'
            );

            row.on('hover:enter', function () {
                play(item);
            });

            html.append(row);
        });

        this.create = function () {
            this.render().append(html);
        };

        this.render = function () {
            return html;
        };

        this.destroy = function () {
            html.remove();
        };

        this.get = function () {
            return html;
        };

        return this;
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (c) {
            return {
                '&': '&amp;', '<': '&lt;', '>': '&gt;',
                '"': '&quot;', "'": '&#39;'
            }[c];
        });
    }

    function registerComponent() {
        try {
            Lampa.Component.add('ua_sources_pro_300_results', component);
        } catch (e) {}
    }

    function registerSearch() {
        if (!Lampa.Search || !Lampa.Search.addSource) return;

        Lampa.Search.addSource({
            title: '🇺🇦 UA Sources PRO',

            search: function (params, oncomplete) {
                var query = String(params.query || params.search || '').trim();

                if (!query) {
                    oncomplete([]);
                    return;
                }

                var cacheKey = query.toLowerCase();
                var cached = cacheGet(cacheKey);

                if (cached) {
                    oncomplete(cached);
                    return;
                }

                var pending = adapters.length;
                var all = [];

                if (!pending) {
                    oncomplete([]);
                    return;
                }

                function finish() {
                    pending--;
                    if (pending <= 0) {
                        cacheSet(cacheKey, all);
                        oncomplete(all);
                    }
                }

                adapters.forEach(function (adapter) {
                    try {
                        adapter.search(query, function (rows) {
                            (rows || []).forEach(function (row) {
                                all.push(normalize(row, adapter));
                            });
                            finish();
                        });
                    } catch (e) {
                        finish();
                    }
                });
            },

            onSelect: function (params, close) {
                if (close) close();

                var item = params.element || {};
                if (item.url) {
                    play(item);
                } else {
                    notify('Виберіть джерело української озвучки');
                }
            }
        });
    }

    /*
     * Safe built-in adapter:
     * public/free video URL supplied by the user in plugin settings.
     * This demonstrates the exact contract required for real official APIs.
     */
    function registerDemoAdapter() {
        addAdapter({
            id: 'public',
            title: 'Публічні українські потоки',
            search: function (query, done) {
                var list = [];

                try {
                    var configured = Lampa.Storage.get('ua_sources_pro_public', []);
                    (configured || []).forEach(function (item) {
                        if (!item.title) return;

                        if (
                            String(item.title).toLowerCase().indexOf(query.toLowerCase()) !== -1 ||
                            String(item.original_title || '').toLowerCase().indexOf(query.toLowerCase()) !== -1
                        ) {
                            list.push(item);
                        }
                    });
                } catch (e) {}

                done(list);
            }
        });
    }

    function settings() {
        /*
         * Keep configuration deliberately simple. A user can store an array
         * of authorized public streams under ua_sources_pro_public using
         * another trusted plugin/integration.
         */
        try {
            Lampa.SettingsApi.addComponent({
                component: 'ua_sources_pro_300',
                name: 'UA Sources PRO',
                type: 'title',
                default: VERSION
            });
        } catch (e) {}
    }

    function start() {
        registerComponent();
        registerDemoAdapter();
        registerSearch();
        settings();

        try {
            Lampa.Manifest.plugins = Lampa.Manifest.plugins || {};
            Lampa.Manifest.plugins.ua_sources_pro_300 = {
                type: 'video',
                version: VERSION,
                name: 'UA Sources PRO',
                description: 'Українські джерела та відтворення у Lampa Player',
                component: 'ua_sources_pro_300'
            };
        } catch (e) {}
    }

    if (window.appready) start();
    else if (Lampa.Listener && Lampa.Listener.follow) {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') start();
        });
    }
})();
