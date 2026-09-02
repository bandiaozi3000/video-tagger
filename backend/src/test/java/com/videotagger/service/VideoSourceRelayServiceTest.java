package com.videotagger.service;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.net.http.HttpClient;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

class VideoSourceRelayServiceTest {
    @Test
    void forwardsRangeAndRefererForBoundCandidate() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(new MockResponse().setResponseCode(206)
                    .setHeader("Content-Type", "video/mp4")
                    .setHeader("Content-Range", "bytes 0-3/8")
                    .setHeader("Accept-Ranges", "bytes")
                    .setBody("test"));
            VideoSourceRelayService service = new VideoSourceRelayService(
                    HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build(), true);
            var response = service.open(new VideoSourceQuickPlayService.RelayTarget(
                    server.url("/video.mp4").toString(), server.url("/play/1").toString(), "video/mp4"), "bytes=0-3");
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            response.getBody().writeTo(output);

            RecordedRequest request = server.takeRequest();
            assertEquals("bytes=0-3", request.getHeader("Range"));
            assertEquals(server.url("/play/1").toString(), request.getHeader("Referer"));
            assertEquals(206, response.getStatusCode().value());
            assertArrayEquals("test".getBytes(), output.toByteArray());
        }
    }
}
