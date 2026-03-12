import { RemoteLayoutDefinition } from '@remote/core';
import { universalTVLayout }        from './layouts/tv-layout';
import { universalACLayout }        from './layouts/ac-layout';
import { universalSpeakerLayout }   from './layouts/speaker-layout';
import { universalSoundbarLayout }  from './layouts/soundbar-layout';
import { universalProjectorLayout } from './layouts/projector-layout';
import { universalFanLayout }       from './layouts/fan-layout';
import { universalLightLayout }     from './layouts/light-layout';
import { universalSTBLayout }       from './layouts/stb-layout';

/**
 * All universal layouts in UX-friendly display order.
 * Use this array to populate a "device type" picker when the user
 * adds a new device without a known brand.
 */
export const allUniversalLayouts: RemoteLayoutDefinition[] = [
  universalTVLayout,
  universalACLayout,
  universalSpeakerLayout,
  universalSoundbarLayout,
  universalProjectorLayout,
  universalFanLayout,
  universalLightLayout,
  universalSTBLayout,
];
