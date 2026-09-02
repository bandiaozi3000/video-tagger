package com.videotagger.videosource;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

final class ProviderHttpClient {
    static final String BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    private static final int DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

    record Response(int statusCode, URI uri, String contentType, byte[] body) {
        String text() {
            return new String(body, StandardCharsets.UTF_8);
        }
    }

    private final String providerId;
    private final URI baseUri;
    private final boolean allowPrivateNetwork;
    private final Duration timeout;
    private final int maxBytes;
    private final HttpClient client;

    ProviderHttpClient(String providerId, String baseUrl, int timeoutMs, boolean allowPrivateNetwork) {
        this(providerId, baseUrl, timeoutMs, allowPrivateNetwork, DEFAULT_MAX_BYTES,
                HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER)
                        .connectTimeout(Duration.ofMillis(timeoutMs)).build());
    }

    ProviderHttpClient(String providerId, String baseUrl, int timeoutMs, boolean allowPrivateNetwork,
                       int maxBytes, HttpClient client) {
        this.providerId = providerId;
        this.baseUri = normalizeBase(baseUrl);
        this.allowPrivateNetwork = allowPrivateNetwork;
        this.timeout = Duration.ofMillis(timeoutMs);
        this.maxBytes = maxBytes;
        this.client = client;
        validateTarget(this.baseUri);
    }

    URI resolve(String pathOrUrl) {
        URI candidate = URI.create(pathOrUrl);
        return candidate.isAbsolute() ? candidate : baseUri.resolve(candidate);
    }

    Response get(String pathOrUrl, Map<String, String> headers) {
        URI target = resolve(pathOrUrl);
        validateTarget(target);
        HttpRequest.Builder builder = HttpRequest.newBuilder(target).GET().timeout(timeout)
                .header("Accept", "application/json, application/xml, text/xml, text/html;q=0.9, */*;q=0.1")
                .header("User-Agent", BROWSER_USER_AGENT);
        headers.forEach(builder::header);
        try {
            HttpResponse<InputStream> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofInputStream());
            int status = response.statusCode();
            if (status >= 300 && status < 400) {
                closeQuietly(response.body());
                throw error("UNSAFE_REDIRECT", "Provider redirect was rejected", false);
            }
            if (status == HttpURLConnection.HTTP_UNAUTHORIZED || status == HttpURLConnection.HTTP_FORBIDDEN) {
                closeQuietly(response.body());
                throw error("LOGIN_REQUIRED", "Provider authentication failed", false);
            }
            if (status == HttpURLConnection.HTTP_NOT_FOUND) {
                closeQuietly(response.body());
                throw error("NOT_FOUND", "Provider resource was not found", false);
            }
            if (status == 429 || status >= 500) {
                closeQuietly(response.body());
                throw error("PROVIDER_UNAVAILABLE", "Provider is temporarily unavailable", true);
            }
            if (status < 200 || status >= 300) {
                closeQuietly(response.body());
                throw error("HTTP_" + status, "Provider request failed", false);
            }
            byte[] body;
            try (InputStream input = response.body()) {
                body = input.readNBytes(maxBytes + 1);
            }
            if (body.length > maxBytes) {
                throw error("RESPONSE_TOO_LARGE", "Provider response exceeded limit", false);
            }
            return new Response(status, target, response.headers().firstValue("Content-Type").orElse(""), body);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw error("INTERRUPTED", "Provider request was interrupted", true, e);
        } catch (IOException e) {
            throw error("NETWORK_ERROR", "Provider request failed", true, e);
        }
    }

    private void validateTarget(URI target) {
        if (!sameOrigin(baseUri, target)) {
            throw error("CROSS_ORIGIN_REQUEST", "Provider request crossed configured origin", false);
        }
        if (target.getUserInfo() != null) {
            throw error("CREDENTIALS_IN_URL", "Credentials in Provider URL are forbidden", false);
        }
        String scheme = target.getScheme();
        if (!("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))) {
            throw error("UNSUPPORTED_PROTOCOL", "Provider protocol is unsupported", false);
        }
        if (!allowPrivateNetwork) {
            RemoteResourcePolicy.validateLocator(target.toString(), false);
        }
    }

    static boolean sameOrigin(URI left, URI right) {
        return left.getScheme().equalsIgnoreCase(right.getScheme())
                && left.getHost().equalsIgnoreCase(right.getHost())
                && effectivePort(left) == effectivePort(right);
    }

    private static int effectivePort(URI uri) {
        if (uri.getPort() >= 0) return uri.getPort();
        return "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
    }

    private static URI normalizeBase(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalArgumentException("Provider base URL is required");
        }
        URI uri = URI.create(baseUrl.trim());
        String path = uri.getPath();
        if (path == null || path.isBlank()) path = "/";
        if (!path.endsWith("/")) path += "/";
        try {
            return new URI(uri.getScheme(), null, uri.getHost(), uri.getPort(), path, null, null);
        } catch (Exception e) {
            throw new IllegalArgumentException("Provider base URL is invalid", e);
        }
    }

    private VideoSourceProviderException error(String code, String message, boolean retryable) {
        return new VideoSourceProviderException(providerId, code, message, retryable);
    }

    private VideoSourceProviderException error(String code, String message, boolean retryable, Throwable cause) {
        return new VideoSourceProviderException(providerId, code, message, retryable, cause);
    }

    private static void closeQuietly(InputStream input) {
        try {
            input.close();
        } catch (IOException ignored) {
        }
    }
}
