package com.videotagger.controller;

import com.videotagger.service.SearchResponse;
import com.videotagger.service.SearchResult;
import com.videotagger.service.SearchService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping
    public SearchResponse search(@RequestParam("q") String query,
                                 @RequestParam(value = "limit", defaultValue = "20") int limit,
                                 @RequestParam(value = "dim", defaultValue = "mixed") String dim) {
        return searchService.search(query, limit, dim);
    }

    @GetMapping("/similar")
    public List<SearchResult> similar(@RequestParam Long id,
                                      @RequestParam(value = "limit", defaultValue = "10") int limit) {
        return searchService.similar(id, limit);
    }
}
