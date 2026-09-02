package com.videotagger.videosource;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Locale;
import java.util.Set;

public final class RemoteResourcePolicy {
    private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https", "file");
    private RemoteResourcePolicy() {}

    public static URI validateLocator(String raw, boolean allowFile) {
        if (raw == null || raw.isBlank()) throw unsafe("EMPTY_LOCATOR");
        final URI uri;
        try { uri = URI.create(raw.trim()); } catch (IllegalArgumentException e) { throw unsafe("INVALID_LOCATOR"); }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!ALLOWED_SCHEMES.contains(scheme) || (!allowFile && "file".equals(scheme))) throw unsafe("UNSUPPORTED_PROTOCOL");
        if (uri.getUserInfo() != null) throw unsafe("CREDENTIALS_IN_URL");
        if (!"file".equals(scheme)) {
            if (uri.getHost() == null || uri.getHost().isBlank()) throw unsafe("MISSING_HOST");
            rejectHost(uri.getHost());
        }
        return uri;
    }

    public static void validateRedirect(String raw, boolean allowFile) { validateLocator(raw, allowFile); }

    public static String redact(String raw) {
        if (raw == null) return null;
        try {
            URI uri = URI.create(raw);
            if (uri.getUserInfo() == null) return raw;
            return new URI(uri.getScheme(), null, uri.getHost(), uri.getPort(), uri.getPath(), uri.getQuery(), uri.getFragment()).toString();
        } catch (Exception e) { return "<redacted>"; }
    }

    private static void rejectHost(String host) {
        String normalized = host.toLowerCase(Locale.ROOT);
        if (normalized.equals("localhost") || normalized.endsWith(".localhost") || normalized.endsWith(".local")) throw unsafe("PRIVATE_HOST");
        try {
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress() || address.isSiteLocalAddress() || address.isMulticastAddress()) throw unsafe("PRIVATE_ADDRESS");
            }
        } catch (UnknownHostException e) { throw unsafe("DNS_FAILED"); }
    }

    private static VideoSourceProviderException unsafe(String code) { return new VideoSourceProviderException("policy", code, "Remote resource rejected", false); }
}