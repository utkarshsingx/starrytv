'use client';

import type { Channel } from '../types';

/**
 * The last resort.
 *
 * If the manifest cannot be fetched and nothing usable is in storage, the set
 * still has to switch on — a television that shows nothing because a JSON file
 * 404'd is worse than one showing a test card, and this is the only tier that
 * cannot itself fail.
 *
 * So it is compiled into the bundle rather than fetched. It is deliberately two
 * channels and a handful of segments: enough that tuning, the guide, the clock
 * and the shader all have something real to work on, small enough that carrying
 * it costs nothing. It is also honest — it says on screen that the schedule is
 * missing, instead of pretending to be the station.
 */
export const MINIMAL_CHANNELS: Channel[] = [
  {
    num: 2,
    slug: 'testcard',
    name: 'TEST CARD',
    color: '#8fb8cc',
    blurb: 'Transmission held. The schedule could not be loaded.',
    programmes: [
      {
        id: 'testcard-00-standby',
        kind: 'ambient',
        heading: 'STANDBY',
        subheading: 'Schedule unavailable',
        lines: [
          'The station is on air, but tonight’s listings did not arrive.',
          '',
          'Everything you can see is being drawn locally.',
        ],
        footer: 'Reload once you are back online and the schedule will return.',
        durationSec: 30,
      },
      {
        id: 'testcard-01-tone',
        kind: 'ambient',
        heading: 'TONE',
        subheading: 'Bars and a steady note',
        lines: ['A flat field of colour.', '', 'Nothing is wrong with your set.'],
        footer: 'Normal programming resumes when the manifest does.',
        durationSec: 24,
      },
    ],
  },
  {
    num: 13,
    slug: 'signoff',
    name: 'SIGN-OFF',
    color: '#8fb8cc',
    blurb: 'Late-night quiet.',
    programmes: [
      {
        id: 'signoff-00-goodnight',
        kind: 'ambient',
        heading: 'GOODNIGHT',
        subheading: 'Close of transmission',
        lines: ['That is everything we have offline.', '', 'Sleep well.'],
        footer: 'Starry Broadcasting System.',
        durationSec: 28,
      },
    ],
  },
];
