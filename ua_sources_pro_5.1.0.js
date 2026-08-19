/*
 * UA Sources PRO 5.1.0 — Playback layer
 * 
 * This version keeps the verified search-source architecture and adds
 * playback only when a source supplies an explicit, public media URL
 * (item.stream / item.file / item.media_url). It does not bypass DRM,
 * authentication, paywalls, CAPTCHA, or protected players.
 */
(function () {
    'use strict';

    function startPlugin() {
        if (!window.Lampa || !Lampa.Search) return;
        if (window.ua_sources_pro_510) return;
        window.ua_sources_pro_510 = true;

        var SOURCE = 'ua_sources_pro';
        var TEST_URL = 'https://github.com/SmartSetup9422/UA-Sources-PRO';

        function addSource(data) {
            if (Lampa.Utils && Lampa.Utils.addSource) return Lampa.Utils.addSource(data, SOURCE);
            return (data || []).map(function (item) {
                item.source = SOURCE;
                return item;
            });
        }

        function play(item) {
            var media = item && (item.stream || item.file || item.media_url);

            if (!media) {
                if (Lampa.Browser && Lampa.Browser.open && item && item.url) {
                    Lampa.Browser.open(item.url);
                    return;
                }
                if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show('UA Sources PRO: відеопотік не наданий джерелом');
                return;
            }

            var element = {
                url: media,
                title: item.title || item.name || '',
                quality: item.quality || '',
                subtitles: item.subtitles || undefined,
                source: SOURCE,
                isonline: true
            };

            try {
                Lampa.Player.play(element);
                if (Lampa.Player.playlist) Lampa.Player.playlist([element]);
            } catch (e) {
                if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show('UA Sources PRO: Lampa Player не зміг відкрити потік');
            }
        }

        function test() {
            return addSource([{
                title: '🇺🇦 UA Sources PRO — PLAYBACK TEST',
                name: 'UA Sources PRO — PLAYBACK TEST',
                release_date: '2026',
                year: '2026',
                url: TEST_URL,
                source: SOURCE,
                source_name: '🇺🇦 UA Sources PRO 5.1.0',
                audio: 'Українська',
                type: 'movie'
            }]);
        }

        var source = {
            title: '🇺🇦 UA Sources PRO',

            search: function (params, oncomplete) {
                var query = String(params && params.query || '');
                try {
                    if (/%[0-9A-F]{2}/i.test(query)) query = decodeURIComponent(query);
                } catch (e) {}

                query = query.replace(/\s+/g, ' ').trim();

                if (!query) {
                    oncomplete([]);
                    return;
                }

                if (query.toUpperCase() === 'UA-SOURCES-TEST') {
                    oncomplete(test());
                    return;
                }

                /*
                 * Real source adapters belong here only when they return
                 * a legitimate public result and, for playback, an explicit
                 * media URL. We do not scrape protected video players.
                 */
                oncomplete([]);
            },

            onCancel: function () {},

            params: {
                lazy: true,
                align_left: true
            },

            onSelect: function (params, close) {
                if (close) close();
                play(params && params.element);
            }
        };

        try {
            Lampa.Search.addSource(source);
            if (Lampa.Noty && Lampa.Noty.show) {
                Lampa.Noty.show('🇺🇦 UA Sources PRO 5.1.0 підключено');
            }
        } catch (e) {
            window.ua_sources_pro_510 = false;
        }
    }

    window.startPlugin = startPlugin;
})();
