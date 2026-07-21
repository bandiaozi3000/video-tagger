package com.videotagger.service;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class JumpQueueTest {

    @Test
    void putThenPollReturnsAndRemoves() {
        JumpQueue queue = new JumpQueue();
        queue.put("https://a.com/v", 123.0);

        Optional<Double> first = queue.poll("https://a.com/v");
        Optional<Double> second = queue.poll("https://a.com/v");

        assertEquals(Optional.of(123.0), first);
        assertTrue(second.isEmpty());
    }

    @Test
    void expiredEntryReturnsEmpty() throws InterruptedException {
        JumpQueue queue = new JumpQueue(50); // 测试用 50ms TTL
        queue.put("https://a.com/v", 123.0);

        Thread.sleep(80);

        assertTrue(queue.poll("https://a.com/v").isEmpty());
    }
}
