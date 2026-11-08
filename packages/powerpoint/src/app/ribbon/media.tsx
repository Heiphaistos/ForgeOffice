// Onglet contextuel « Lecture » d'un audio ou d'une vidéo : aperçu, volume, démarrage, boucle, masquage.
import type { RibbonTab } from '@forgeoffice/ui';
import { S3 } from '../strings-text.ts';
import { VOLUME_CHOICES, isPreviewing, selectedMedia, setPlayback, togglePreview, volumeChoice } from '../media-ops.ts';
import type { TabContext } from './common.tsx';

const M = S3.media;

export function mediaPlaybackTab(ctx: TabContext): RibbonTab {
  const { ed } = ctx;
  const media = selectedMedia(ed);
  const pb = media?.playback;
  const playing = media ? isPreviewing(media.id) : false;
  return {
    id: 'mediaPlayback',
    label: M.tab,
    keytip: 'JL',
    contextual: { set: ed.selectedShapes[0]?.kind === 'media' && media?.mediaType === 'video' ? 'Outils Vidéo' : 'Outils Audio', color: '#C43E1C' },
    hidden: !media,
    groups: [
      {
        id: 'preview', label: M.tab, icon: 'play',
        controls: [{ kind: 'button', id: 'play', label: playing ? M.stop : M.play, icon: playing ? 'dismiss' : 'play', size: 'large', onClick: () => media && togglePreview(ed, media) }],
      },
      {
        id: 'options', label: M.start, icon: 'speaker_2',
        controls: [
          { kind: 'menu', id: 'volume', label: `${M.volume} : ${M.volumes[volumeChoice(pb?.volume)]}`, icon: 'speaker_2', size: 'large', items: VOLUME_CHOICES.map(([key, v]) => ({ id: key, label: M.volumes[key], checked: volumeChoice(pb?.volume) === key, onClick: () => setPlayback(ed, { volume: v }) })) },
          {
            kind: 'combo', id: 'start', label: M.start, width: 150, value: pb?.auto ? M.auto : M.onClick,
            options: [{ value: M.onClick }, { value: M.auto }],
            onChange: (v) => setPlayback(ed, { auto: v === M.auto }),
          },
          { kind: 'checkbox', id: 'loop', label: M.loop, checked: !!pb?.loop, onChange: (v) => setPlayback(ed, { loop: v }) },
          { kind: 'checkbox', id: 'hide', label: M.hide, checked: !!pb?.hideInShow, onChange: (v) => setPlayback(ed, { hideInShow: v }) },
        ],
      },
    ],
  };
}
