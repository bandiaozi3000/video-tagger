import type { MultiMediaPocInput } from './types';

/** 沙盒样例输入：覆盖分组（year）、每屏 N 部、片段/资料两种媒体与 BGM 两曲。 */
export const defaultPocInput: MultiMediaPocInput = {
  template: 'MULTI_MEDIA_REMOTION_POC',
  style: 'chapter',
  title: '夜间片单',
  subtitle: '值得留在记忆里的动画瞬间',
  intro: '这一季挑了六部，从冬夜的雪到夏末的电车，按年份排开。',
  assetBaseUrl: 'http://127.0.0.1:18126/assets',
  media: [
    {
      mediaId: 1001,
      order: 1,
      mode: 'CLIPS_SELECTED',
      title: '作品 A',
      originalTitle: 'Title A',
      year: 2024,
      season: 1,
      coverAssetPath: 'media/poster-a.jpg',
      description: '一段用于验证资料卡与片段衔接的简介。',
      tags: ['冒险', '成长'],
      group: '2024 年',
      clips: [
        { clipId: 501, episodeNo: 3, episodeTitle: '第三集', title: '爆发瞬间', assetPath: 'media/clip-a.mp4', durationMs: 4000, hasAudio: true },
        { clipId: 502, episodeNo: 7, episodeTitle: '第七集', title: '回望时刻', assetPath: 'media/clip-b.mp4', durationMs: 3500, hasAudio: false },
      ],
    },
    {
      mediaId: 1002,
      order: 2,
      mode: 'INFO_ONLY',
      title: '作品 B',
      year: 2024,
      season: 2,
      coverAssetPath: 'media/poster-b.jpg',
      description: '没有选中片段时仍然保留的资料型推荐内容。',
      tags: ['日常', '喜剧'],
      group: '2024 年',
      clips: [],
    },
    {
      mediaId: 1003,
      order: 3,
      mode: 'CLIPS_SELECTED',
      title: '作品 C',
      originalTitle: 'Title C',
      year: 2020,
      coverAssetPath: 'media/poster-c.jpg',
      description: '最后一个媒体，用于验证跨媒体切换。',
      tags: ['科幻'],
      group: '2020 年',
      clips: [
        { clipId: 503, episodeNo: 1, title: '开场片段', assetPath: 'media/clip-c.mp4', durationMs: 3000, hasAudio: true },
      ],
    },
  ],
  params: {
    groupBy: 'year',
    perScreen: 1,
    bgmTracks: [
      { name: '夜色航线', durationSec: 30, assetPath: 'media/bgm-a.mp3' },
      { name: '夏日回响', durationSec: 30, assetPath: 'media/bgm-b.mp3' },
    ],
  },
};
