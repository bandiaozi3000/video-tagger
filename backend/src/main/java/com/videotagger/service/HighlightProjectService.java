package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.HighlightProject;
import com.videotagger.entity.HighlightProjectItem;
import com.videotagger.entity.Media;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.HighlightProjectItemMapper;
import com.videotagger.mapper.HighlightProjectMapper;
import com.videotagger.mapper.HighlightExportMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.service.HighlightExportService.HighlightExportView;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

@Service
public class HighlightProjectService {
    private static final Set<String> SPOILER_STATES = Set.of("PENDING", "SAFE", "SPOILER");
    private static final Set<String> SOURCE_STATES = Set.of("PENDING", "PREPARING", "READY", "UNAVAILABLE", "FAILED");
    private static final int MAX_CAPTION_LENGTH = 200;
    private static final int MAX_CONFIG_LENGTH = 200_000;

    private final HighlightProjectMapper projectMapper;
    private final HighlightProjectItemMapper itemMapper;
    private final HighlightExportService exportService;
    private final MediaMapper mediaMapper;
    private final ClipMapper clipMapper;
    private final HighlightProperties properties;

    public HighlightProjectService(HighlightProjectMapper projectMapper, HighlightProjectItemMapper itemMapper,
                                   HighlightExportService exportService, MediaMapper mediaMapper,
                                   ClipMapper clipMapper, HighlightProperties properties) {
        this.projectMapper = projectMapper;
        this.itemMapper = itemMapper;
        this.exportService = exportService;
        this.mediaMapper = mediaMapper;
        this.clipMapper = clipMapper;
        this.properties = properties;
    }

    @Transactional
    public HighlightProjectView getOrCreate(long mediaId) {
        requireVideoMedia(mediaId);
        HighlightProject project = projectMapper.selectByMediaId(mediaId);
        if (project == null) {
            long now = System.currentTimeMillis();
            project = new HighlightProject();
            project.setMediaId(mediaId);
            project.setName("高光推荐");
            project.setConfigJson("{}");
            project.setCreatedAt(now);
            project.setUpdatedAt(now);
            projectMapper.insert(project);
        }
        return view(project);
    }

    public HighlightProjectView getByMediaId(long mediaId) {
        requireVideoMedia(mediaId);
        HighlightProject project = projectMapper.selectByMediaId(mediaId);
        if (project == null) throw new NoSuchElementException("高光制作项目不存在");
        return view(project);
    }

    public HighlightProjectView get(long projectId) {
        return view(requireProject(projectId));
    }

    @Transactional
    public HighlightProjectView updateProject(long projectId, ProjectUpdateRequest request) {
        HighlightProject project = requireProject(projectId);
        if (request == null) return view(project);
        if (request.name() != null) {
            String name = request.name().trim();
            if (name.isEmpty() || name.length() > 120) throw new IllegalArgumentException("项目名称长度应为 1–120 个字符");
            project.setName(name);
        }
        if (request.configJson() != null) {
            if (request.configJson().length() > MAX_CONFIG_LENGTH) throw new IllegalArgumentException("项目配置过大");
            project.setConfigJson(request.configJson());
        }
        project.setUpdatedAt(System.currentTimeMillis());
        projectMapper.updateById(project);
        return view(project);
    }

    @Transactional
    public HighlightProjectView addItem(long projectId, AddItemRequest request) {
        if (request == null || request.clipId() == null) throw new IllegalArgumentException("请选择片段");
        HighlightProject project = requireProject(projectId);
        Clip clip = requireClipForMedia(request.clipId(), project.getMediaId());
        if (itemMapper.selectCount(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<HighlightProjectItem>()
                .eq("project_id", projectId).eq("clip_id", clip.getId())) > 0) {
            throw new IllegalArgumentException("该片段已在时间线中");
        }
        if (itemMapper.selectCount(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<HighlightProjectItem>()
                .eq("project_id", projectId)) >= properties.getMaxItems()) {
            throw new IllegalArgumentException("时间线片段数超过 " + properties.getMaxItems() + " 条上限");
        }
        HighlightProjectItem item = new HighlightProjectItem();
        long now = System.currentTimeMillis();
        item.setProjectId(projectId);
        item.setClipId(clip.getId());
        item.setSortOrder(itemMapper.nextSortOrder(projectId));
        item.setInSec(clip.getTimestampSec());
        item.setOutSec(effectiveEnd(clip));
        item.setSpoilerState("PENDING");
        item.setSourceType("LOCAL_LIBRARY");
        item.setSourceState(item.getOutSec() == null ? "UNAVAILABLE" : "PENDING");
        item.setSourceMessage(item.getOutSec() == null ? "原片段没有可确定的结束时间，请先在工作台补齐" : null);
        item.setOriginalVolume(100);
        item.setCreatedAt(now);
        item.setUpdatedAt(now);
        itemMapper.insert(item);
        touch(project);
        return view(project);
    }

    @Transactional
    public HighlightProjectView updateItem(long projectId, long itemId, ItemUpdateRequest request) {
        HighlightProject project = requireProject(projectId);
        HighlightProjectItem item = requireItem(projectId, itemId);
        if (request == null) return view(project);
        Double in = request.inSec() == null ? item.getInSec() : request.inSec();
        Double out = request.outSec() == null ? item.getOutSec() : request.outSec();
        HighlightProjectRules.validateRange(in, out);
        boolean rangeChanged = request.inSec() != null || request.outSec() != null;
        if (request.inSec() != null) item.setInSec(in);
        if (request.outSec() != null) item.setOutSec(out);
        if (request.caption() != null) {
            String caption = request.caption().trim();
            if (caption.length() > MAX_CAPTION_LENGTH) throw new IllegalArgumentException("片段短标题不能超过 " + MAX_CAPTION_LENGTH + " 个字符");
            item.setCaption(caption.isEmpty() ? null : caption);
        }
        if (request.spoilerState() != null) item.setSpoilerState(normalizeSpoiler(request.spoilerState()));
        if (rangeChanged && "LOCAL_LIBRARY".equals(item.getSourceType())) {
            item.setSourceState("PENDING");
            item.setSourcePath(null);
            item.setSourceMessage("时间范围已调整，请重新准备素材");
        }
        item.setUpdatedAt(System.currentTimeMillis());
        itemMapper.updateById(item);
        touch(project);
        return view(project);
    }

    @Transactional
    public HighlightProjectView removeItem(long projectId, long itemId) {
        HighlightProject project = requireProject(projectId);
        requireItem(projectId, itemId);
        itemMapper.deleteById(itemId);
        touch(project);
        return view(project);
    }

    @Transactional
    public HighlightProjectView reorder(long projectId, List<Long> itemIds) {
        HighlightProject project = requireProject(projectId);
        List<HighlightProjectItem> items = itemMapper.listByProjectId(projectId);
        if (itemIds == null || itemIds.size() != items.size()) throw new IllegalArgumentException("排序项目不完整");
        Set<Long> expected = new HashSet<>(items.stream().map(HighlightProjectItem::getId).toList());
        if (!expected.equals(new HashSet<>(itemIds))) throw new IllegalArgumentException("排序项目不属于当前制作稿");
        long now = System.currentTimeMillis();
        for (int index = 0; index < itemIds.size(); index++) {
            HighlightProjectItem item = requireItem(projectId, itemIds.get(index));
            item.setSortOrder(index);
            item.setUpdatedAt(now);
            itemMapper.updateById(item);
        }
        touch(project);
        return view(project);
    }

    public HighlightProjectItem requireItem(long projectId, long itemId) {
        HighlightProjectItem item = itemMapper.selectByProjectAndId(projectId, itemId);
        if (item == null) throw new NoSuchElementException("高光项目片段不存在");
        return item;
    }

    public HighlightProject requireProject(long projectId) {
        HighlightProject project = projectMapper.selectById(projectId);
        if (project == null) throw new NoSuchElementException("高光制作项目不存在");
        if (mediaMapper.selectById(project.getMediaId()) == null) {
            throw new IllegalStateException("原媒体已永久删除，草稿不可再编辑");
        }
        return project;
    }

    @Transactional
    public void updateSource(long projectId, long itemId, String type, String state, String path, String url, String message) {
        HighlightProjectItem item = requireItem(projectId, itemId);
        if (!SOURCE_STATES.contains(state)) throw new IllegalArgumentException("非法素材状态");
        item.setSourceType(type);
        item.setSourceState(state);
        item.setSourcePath(path);
        item.setSourceUrl(url);
        item.setSourceMessage(message);
        item.setUpdatedAt(System.currentTimeMillis());
        itemMapper.updateById(item);
        touch(requireProject(projectId));
    }

    @Transactional
    public void markClipUnavailable(long clipId, String message) {
        itemMapper.markUnavailableByClipId(clipId, "UNAVAILABLE", message, System.currentTimeMillis());
    }

    public List<Clip> clips(long projectId) {
        HighlightProject project = requireProject(projectId);
        return clipMapper.listByMedia(project.getMediaId());
    }

    public List<HighlightExportView> exports(long projectId) {
        requireProject(projectId);
        return exportService.list(projectId);
    }

    private HighlightProjectView view(HighlightProject project) {
        List<HighlightProjectItem> items = itemMapper.listByProjectId(project.getId()).stream()
                .map(this::publicItem)
                .toList();
        return new HighlightProjectView(project.getId(), project.getMediaId(), project.getName(), project.getConfigJson(),
                project.getCreatedAt(), project.getUpdatedAt(), items, exports(project.getId()));
    }

    private HighlightProjectItem publicItem(HighlightProjectItem item) {
        HighlightProjectItem copy = new HighlightProjectItem();
        copy.setId(item.getId());
        copy.setProjectId(item.getProjectId());
        copy.setClipId(item.getClipId());
        copy.setSortOrder(item.getSortOrder());
        copy.setInSec(item.getInSec());
        copy.setOutSec(item.getOutSec());
        copy.setSpoilerState(item.getSpoilerState());
        copy.setCaption(item.getCaption());
        copy.setSourceType(item.getSourceType());
        copy.setSourceState(item.getSourceState());
        copy.setSourceMessage(item.getSourceMessage());
        copy.setOriginalVolume(item.getOriginalVolume());
        copy.setCreatedAt(item.getCreatedAt());
        copy.setUpdatedAt(item.getUpdatedAt());
        return copy;
    }

    private void requireVideoMedia(long mediaId) {
        Media media = mediaMapper.selectById(mediaId);
        if (media == null || media.getDeletedAt() != null) throw new NoSuchElementException("媒体不存在");
        if (!"VIDEO".equals(media.getMediaFormat())) throw new IllegalArgumentException("只有视频媒体可以制作高光推荐");
    }

    private Clip requireClipForMedia(long clipId, long mediaId) {
        Clip clip = clipMapper.selectById(clipId);
        if (clip == null || !clipMapper.listByMedia(mediaId).stream().anyMatch(c -> c.getId().equals(clipId))) {
            throw new IllegalArgumentException("片段不属于当前媒体");
        }
        return clip;
    }

    private static Double effectiveEnd(Clip clip) {
        if (clip.getEndSec() != null && clip.getTimestampSec() != null && clip.getEndSec() > clip.getTimestampSec()) return clip.getEndSec();
        if (clip.getVideoDuration() != null && clip.getTimestampSec() != null && clip.getVideoDuration() > clip.getTimestampSec()) return clip.getVideoDuration();
        return null;
    }

    private static String normalizeSpoiler(String state) {
        String normalized = state.trim().toUpperCase();
        if (!SPOILER_STATES.contains(normalized)) throw new IllegalArgumentException("剧透状态只能是 PENDING、SAFE 或 SPOILER");
        return normalized;
    }

    private static int clampVolume(int volume) {
        return Math.max(0, Math.min(100, volume));
    }

    private void touch(HighlightProject project) {
        project.setUpdatedAt(System.currentTimeMillis());
        projectMapper.updateById(project);
    }

    public record ProjectUpdateRequest(String name, String configJson) { }
    public record AddItemRequest(Long clipId) { }
    public record ItemUpdateRequest(Double inSec, Double outSec, String spoilerState, String caption, Integer originalVolume) { }
    public record HighlightProjectView(long id, long mediaId, String name, String configJson, long createdAt, long updatedAt,
                                       List<HighlightProjectItem> items, List<HighlightExportView> exports) { }
}
