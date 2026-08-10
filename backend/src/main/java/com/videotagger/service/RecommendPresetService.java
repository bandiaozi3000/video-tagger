package com.videotagger.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.videotagger.entity.RecommendDraft;
import com.videotagger.entity.RecommendTemplate;
import com.videotagger.mapper.RecommendDraftMapper;
import com.videotagger.mapper.RecommendTemplateMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

/** 推荐预设：草稿（单条自动保存/恢复）+ 模板（命名复用，列表/载入/删除）。config 存 JSON 字符串。 */
@Service
public class RecommendPresetService {

    private static final long DRAFT_ID = 1L;

    private final RecommendDraftMapper draftMapper;
    private final RecommendTemplateMapper templateMapper;

    public RecommendPresetService(RecommendDraftMapper draftMapper, RecommendTemplateMapper templateMapper) {
        this.draftMapper = draftMapper;
        this.templateMapper = templateMapper;
    }

    /** 保存草稿（upsert id=1）。config 为 JSON 字符串（含 BGM base64）。 */
    @Transactional
    public void saveDraft(String config) {
        RecommendDraft d = draftMapper.selectById(DRAFT_ID);
        long now = System.currentTimeMillis();
        if (d == null) {
            d = new RecommendDraft();
            d.setId(DRAFT_ID);
            d.setConfig(config);
            d.setUpdatedAt(now);
            draftMapper.insert(d);
        } else {
            d.setConfig(config);
            d.setUpdatedAt(now);
            draftMapper.updateById(d);
        }
    }

    /** 读草稿；无草稿返回 null。 */
    public RecommendDraft loadDraft() {
        return draftMapper.selectById(DRAFT_ID);
    }

    /** 另存为模板（config 不含 BGM）。 */
    @Transactional
    public RecommendTemplate saveTemplate(String name, String config) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("模板名不能为空");
        }
        RecommendTemplate t = new RecommendTemplate();
        t.setName(name.trim());
        t.setConfig(config);
        t.setCreatedAt(System.currentTimeMillis());
        templateMapper.insert(t);
        return t;
    }

    /** 模板列表：只查 id/name/created_at（config 含 BGM base64 可能很大，载入时单独取）。 */
    public List<RecommendTemplate> listTemplates() {
        return templateMapper.selectList(new QueryWrapper<RecommendTemplate>()
                .select("id", "name", "created_at")
                .orderByDesc("created_at"));
    }

    /** 更新模板内容（config 含 BGM）；name 非空可一并改名。 */
    @Transactional
    public RecommendTemplate updateTemplate(Long id, String name, String config) {
        RecommendTemplate t = templateMapper.selectById(id);
        if (t == null) {
            throw new NoSuchElementException("模板不存在: " + id);
        }
        if (name != null && !name.isBlank()) {
            t.setName(name.trim());
        }
        t.setConfig(config);
        templateMapper.updateById(t);
        return t;
    }

    public RecommendTemplate getTemplate(Long id) {
        RecommendTemplate t = templateMapper.selectById(id);
        if (t == null) {
            throw new NoSuchElementException("模板不存在: " + id);
        }
        return t;
    }

    public void deleteTemplate(Long id) {
        templateMapper.deleteById(id);
    }
}
