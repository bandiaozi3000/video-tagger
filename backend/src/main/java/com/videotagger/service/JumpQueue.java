package com.videotagger.service;

import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class JumpQueue {

    private static final long DEFAULT_TTL_MS = 30_000;

    private final ConcurrentHashMap<String, Entry> entries = new ConcurrentHashMap<>();
    private final long ttlMs;

    public JumpQueue() {
        this(DEFAULT_TTL_MS);
    }

    JumpQueue(long ttlMs) {
        this.ttlMs = ttlMs;
    }

    public void put(String url, double timestampSec) {
        entries.put(url, new Entry(timestampSec, System.currentTimeMillis() + ttlMs));
    }

    /** 取出即删；已过期返回空 */
    public Optional<Double> poll(String url) {
        Entry entry = entries.remove(url);
        if (entry == null || entry.expiresAt() < System.currentTimeMillis()) {
            return Optional.empty();
        }
        return Optional.of(entry.timestampSec());
    }

    private record Entry(double timestampSec, long expiresAt) {
    }
}
