package com.videotagger.service;

import com.videotagger.videosource.RemoteResourcePolicy;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.regex.Pattern;

@Service
public class VideoSourceRelayService {
    private static final Pattern RANGE = Pattern.compile("bytes=\\d*-\\d*");
    private final HttpClient client;
    private final boolean allowPrivateNetwork;

    public VideoSourceRelayService() {
        this(HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build(), false);
    }

    VideoSourceRelayService(HttpClient client, boolean allowPrivateNetwork) {
        this.client = client;
        this.allowPrivateNetwork = allowPrivateNetwork;
    }

    public ResponseEntity<StreamingResponseBody> open(VideoSourceQuickPlayService.RelayTarget target, String range) {
        try {
            HttpResponse<InputStream> response = request(target, range, URI.create(target.locator()), 0);
            int status = response.statusCode();
            if (status != 200 && status != 206 && status != 416) {
                response.body().close();
                throw new IllegalStateException("媒体线路返回 HTTP " + status);
            }
            HttpHeaders headers = new HttpHeaders();
            copy(response, headers, "Content-Type");
            copy(response, headers, "Content-Length");
            copy(response, headers, "Content-Range");
            copy(response, headers, "Accept-Ranges");
            if (!headers.containsKey(HttpHeaders.CONTENT_TYPE) && target.mimeType() != null) {
                headers.set(HttpHeaders.CONTENT_TYPE, target.mimeType());
            }
            headers.setCacheControl("no-store");
            StreamingResponseBody body = output -> {
                try (InputStream input = response.body()) {
                    input.transferTo(output);
                }
            };
            return new ResponseEntity<>(body, headers, HttpStatus.valueOf(status));
        } catch (IOException e) {
            throw new IllegalStateException("媒体线路读取失败", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("媒体线路读取被中断", e);
        }
    }

    private HttpResponse<InputStream> request(VideoSourceQuickPlayService.RelayTarget target, String range,
                                               URI uri, int redirects) throws IOException, InterruptedException {
        if (!allowPrivateNetwork) RemoteResourcePolicy.validateLocator(uri.toString(), false);
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                .GET()
                .timeout(Duration.ofSeconds(30))
                .header("Accept", "*/*")
                .header("Accept-Encoding", "identity")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
        if (range != null && RANGE.matcher(range).matches()) builder.header("Range", range);
        if (target.referer() != null && !target.referer().isBlank()) builder.header("Referer", target.referer());
        HttpResponse<InputStream> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() >= 300 && response.statusCode() < 400 && redirects < 3) {
            String location = response.headers().firstValue("Location").orElseThrow();
            response.body().close();
            return request(target, range, uri.resolve(location), redirects + 1);
        }
        return response;
    }

    private static void copy(HttpResponse<?> response, HttpHeaders target, String name) {
        response.headers().firstValue(name).ifPresent(value -> target.set(name, value));
    }
}
