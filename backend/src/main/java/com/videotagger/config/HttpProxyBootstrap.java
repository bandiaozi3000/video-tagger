package com.videotagger.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

/** 外站抓取代理引导（v0.25）：把 yml 的 videotagger.http-proxy.* 注入 java.net.http 默认代理系统属性。
 *  留空 host 则不设代理（直连）；java.net.http 的默认 ProxySelector 每次查询都读系统属性，晚于
 *  ProviderHttpClient 构建也生效，故无需调整各 provider 构造顺序。 */
@Component
public class HttpProxyBootstrap {

    private final String host;
    private final int port;

    public HttpProxyBootstrap(
            @Value("${videotagger.http-proxy.host:}") String host,
            @Value("${videotagger.http-proxy.port:0}") int port) {
        this.host = host == null ? "" : host.trim();
        this.port = port;
    }

    @PostConstruct
    public void apply() {
        if (host.isEmpty() || port <= 0 || port > 65535) {
            return;
        }
        System.setProperty("http.proxyHost", host);
        System.setProperty("http.proxyPort", String.valueOf(port));
        System.setProperty("https.proxyHost", host);
        System.setProperty("https.proxyPort", String.valueOf(port));
    }
}
