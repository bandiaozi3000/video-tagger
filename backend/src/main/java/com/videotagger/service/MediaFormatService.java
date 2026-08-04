package com.videotagger.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.videotagger.entity.MediaFormat;
import com.videotagger.entity.MediaSubcategory;
import com.videotagger.mapper.MediaFormatMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaSubcategoryMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

/** 媒体格式 / 子分类字典维护。删除保护：格式或子分类仍被媒体引用时拒绝删除。 */
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

    /** 全部格式 + 子分类 + 每子分类媒体数，按 sort 排序。 */
    public List<MediaFormatView> listFormats() {
        return mediaFormatMapper.selectList(new QueryWrapper<MediaFormat>().orderByAsc("sort")).stream()
                .map(f -> {
                    List<MediaFormatView.SubcategoryView> subs = mediaSubcategoryMapper.listByFormat(f.getId())
                            .stream()
                            .map(s -> new MediaFormatView.SubcategoryView(s.getId(), s.getName(),
                                    mediaMapper.countBySubcategory(s.getName())))
                            .toList();
                    return new MediaFormatView(f.getId(), f.getCode(), f.getName(), f.getHasChildren(), subs);
                })
                .toList();
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

    @Transactional
    public MediaSubcategory addSubcategory(Long formatId, String name) {
        MediaFormat mf = mediaFormatMapper.selectById(formatId);
        if (mf == null) {
            throw new NoSuchElementException("format not found: " + formatId);
        }
        String n = name == null ? "" : name.trim();
        if (n.isEmpty()) {
            throw new IllegalArgumentException("子分类名不能为空");
        }
        long dup = mediaSubcategoryMapper.selectCount(new QueryWrapper<MediaSubcategory>()
                .eq("format_id", formatId).eq("name", n));
        if (dup > 0) {
            throw new IllegalArgumentException("子分类已存在: " + n);
        }
        MediaSubcategory s = new MediaSubcategory();
        s.setFormatId(formatId);
        s.setName(n);
        s.setCreatedAt(System.currentTimeMillis());
        mediaSubcategoryMapper.insert(s);
        return s;
    }

    /** 删除子分类：无媒体引用时才允许。 */
    @Transactional
    public void deleteSubcategory(Long subId) {
        MediaSubcategory s = mediaSubcategoryMapper.selectById(subId);
        if (s == null) {
            return;
        }
        if (mediaMapper.countBySubcategory(s.getName()) > 0) {
            throw new IllegalArgumentException("该子分类下存在媒体，不能删除: " + s.getName());
        }
        mediaSubcategoryMapper.deleteById(subId);
    }
}
