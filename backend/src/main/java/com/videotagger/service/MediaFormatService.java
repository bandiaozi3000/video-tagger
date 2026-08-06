package com.videotagger.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.videotagger.entity.MediaFormat;
import com.videotagger.entity.MediaSubcategory;
import com.videotagger.mapper.MediaFormatMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaSubcategoryMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

/** 媒体格式 / 子分类树字典维护。子分类为任意深度邻接表树（parent_id，0=根），媒体可挂任意节点。
 *  删除保护：格式有媒体引用、节点有下级或子树挂媒体时拒绝删除。 */
@Service
public class MediaFormatService {

    private final MediaFormatMapper mediaFormatMapper;
    private final MediaSubcategoryMapper mediaSubcategoryMapper;
    private final MediaMapper mediaMapper;

    public MediaFormatService(MediaFormatMapper mediaFormatMapper,
                              MediaSubcategoryMapper mediaSubcategoryMapper,
                              MediaMapper mediaMapper) {
        this.mediaFormatMapper = mediaFormatMapper;
        this.mediaSubcategoryMapper = mediaSubcategoryMapper;
        this.mediaMapper = mediaMapper;
    }

    /** 全部格式 + 子分类树（全量 flat，前端按 parentId 组树）+ 每节点子树媒体数。 */
    public List<MediaFormatView> listFormats() {
        return mediaFormatMapper.selectList(new QueryWrapper<MediaFormat>().orderByAsc("sort")).stream()
                .map(f -> {
                    List<MediaSubcategory> all = mediaSubcategoryMapper.listByFormat(f.getId());
                    Map<Long, Long> subtreeCount = subtreeCounts(all);
                    List<MediaFormatView.SubcategoryView> subs = all.stream()
                            .map(s -> new MediaFormatView.SubcategoryView(s.getId(), s.getParentId(), s.getName(),
                                    subtreeCount.getOrDefault(s.getId(), 0L)))
                            .toList();
                    return new MediaFormatView(f.getId(), f.getCode(), f.getName(), f.getHasChildren(), subs);
                })
                .toList();
    }

    /** 子树媒体数：节点直接计数一次查全，内存 DFS 自底向上累计（虚拟根 0 不含自身媒体）。 */
    private Map<Long, Long> subtreeCounts(List<MediaSubcategory> all) {
        Map<Long, Long> direct = new HashMap<>();
        long formatId = all.isEmpty() ? 0 : all.get(0).getFormatId();
        for (MediaMapper.SubcategoryDirectCount c : mediaMapper.countDirectByFormat(formatId)) {
            direct.put(c.subcategoryId(), c.count());
        }
        Map<Long, List<MediaSubcategory>> children = all.stream()
                .collect(Collectors.groupingBy(s -> s.getParentId()));
        Map<Long, Long> subtree = new HashMap<>();
        accumulate(0L, children, direct, subtree);
        return subtree;
    }

    private long accumulate(Long nodeId, Map<Long, List<MediaSubcategory>> children,
                            Map<Long, Long> direct, Map<Long, Long> subtree) {
        long total = direct.getOrDefault(nodeId, 0L);
        for (MediaSubcategory child : children.getOrDefault(nodeId, List.of())) {
            total += accumulate(child.getId(), children, direct, subtree);
        }
        subtree.put(nodeId, total);
        return total;
    }

    @Transactional
    public MediaFormat createFormat(String code, String name, Integer hasChildren) {
        if (code == null || code.isBlank() || name == null || name.isBlank()) {
            throw new IllegalArgumentException("code/name 不能为空");
        }
        String c = code.trim().toUpperCase();
        if (mediaFormatMapper.selectOne(new QueryWrapper<MediaFormat>().eq("code", c)) != null) {
            throw new IllegalArgumentException("格式已存在: " + c);
        }
        MediaFormat mf = new MediaFormat();
        mf.setCode(c);
        mf.setName(name.trim());
        mf.setHasChildren(hasChildren != null && hasChildren == 1 ? 1 : 0);
        mf.setCreatedAt(System.currentTimeMillis());
        mediaFormatMapper.insert(mf);
        return mf;
    }

    /** 删除格式：无媒体引用时连其子分类一并删除。 */
    @Transactional
    public void deleteFormat(Long id) {
        MediaFormat mf = mediaFormatMapper.selectById(id);
        if (mf == null) {
            return;
        }
        if (mediaMapper.countByFormat(mf.getCode()) > 0) {
            throw new IllegalArgumentException("格式下存在媒体，不能删除: " + mf.getName());
        }
        mediaSubcategoryMapper.delete(new QueryWrapper<MediaSubcategory>().eq("format_id", id));
        mediaFormatMapper.deleteById(id);
    }

    /** 加子分类：parentId 非 0 时须属于同一格式树；format_id 继承父（根节点=本格式）。同级 (parent_id,name) 唯一。 */
    @Transactional
    public MediaSubcategory addSubcategory(Long formatId, Long parentId, String name) {
        MediaFormat mf = mediaFormatMapper.selectById(formatId);
        if (mf == null) {
            throw new NoSuchElementException("format not found: " + formatId);
        }
        long parent = parentId == null ? 0 : parentId;
        if (parent != 0) {
            MediaSubcategory p = mediaSubcategoryMapper.selectById(parent);
            if (p == null || !p.getFormatId().equals(formatId)) {
                throw new IllegalArgumentException("父分类不存在或不属于该格式: " + parent);
            }
        }
        String n = name == null ? "" : name.trim();
        if (n.isEmpty()) {
            throw new IllegalArgumentException("子分类名不能为空");
        }
        long dup = mediaSubcategoryMapper.selectCount(new QueryWrapper<MediaSubcategory>()
                .eq("parent_id", parent).eq("name", n));
        if (dup > 0) {
            throw new IllegalArgumentException("同级分类已存在: " + n);
        }
        MediaSubcategory s = new MediaSubcategory();
        s.setFormatId(formatId);
        s.setParentId(parent);
        s.setName(n);
        s.setCreatedAt(System.currentTimeMillis());
        mediaSubcategoryMapper.insert(s);
        return s;
    }

    /** 删除子分类：有下级节点或子树挂媒体（含其下级）时拒绝。 */
    @Transactional
    public void deleteSubcategory(Long subId) {
        MediaSubcategory s = mediaSubcategoryMapper.selectById(subId);
        if (s == null) {
            return;
        }
        long child = mediaSubcategoryMapper.selectCount(
                new QueryWrapper<MediaSubcategory>().eq("parent_id", subId));
        if (child > 0) {
            throw new IllegalArgumentException("该分类下存在下级分类，请先删除下级: " + s.getName());
        }
        if (mediaMapper.countBySubcategoryId(subId) > 0) {
            throw new IllegalArgumentException("该分类下存在媒体，不能删除: " + s.getName());
        }
        mediaSubcategoryMapper.deleteById(subId);
    }
}
