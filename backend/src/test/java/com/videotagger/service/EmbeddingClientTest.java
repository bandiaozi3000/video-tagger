package com.videotagger.service;

import com.videotagger.config.EmbeddingProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class EmbeddingClientTest {

    @Test
    void embedParsesVector() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(new MockResponse()
                    .setBody("{\"data\":[{\"embedding\":[0.5,0.25]}]}")
                    .addHeader("Content-Type", "application/json"));
            server.start();

            EmbeddingProperties props = new EmbeddingProperties();
            props.setBaseUrl(server.url("/").toString());
            props.setApiKey("test-key");
            props.setModel("test-model");

            EmbeddingClient client = new EmbeddingClient(props);
            float[] vector = client.embed("测试文本");

            assertArrayEquals(new float[]{0.5f, 0.25f}, vector);
        }
    }

    @Test
    void isConfiguredFalseWhenKeyBlank() {
        EmbeddingProperties props = new EmbeddingProperties();
        props.setBaseUrl("http://localhost:1234");
        props.setApiKey("");

        assertFalse(new EmbeddingClient(props).isConfigured());
    }
}
