package com.videotagger.controller;

import com.videotagger.service.MaterializeBatchService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** v0.24 批量素材化（延迟物化）：给一批片段逐个求值/裁剪，无文件者汇总待预取清单。 */
@RestController
@RequestMapping("/api/clips/materialize-batch")
public class MaterializeBatchController {

    private final MaterializeBatchService service;

    public MaterializeBatchController(MaterializeBatchService service) {
        this.service = service;
    }

    /** body: { "clipIds": [1,2,3] } → 逐个物化 + 待预取（按 Bangumi 集去重）。 */
    @PostMapping
    public MaterializeBatchService.BatchResult materialize(@RequestBody BatchRequest req) {
        return service.materialize(req.clipIds());
    }

    public record BatchRequest(List<Long> clipIds) {
    }
}
