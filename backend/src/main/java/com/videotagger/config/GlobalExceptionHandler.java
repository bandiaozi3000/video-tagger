package com.videotagger.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.NoSuchElementException;
import java.util.stream.Collectors;

/** 统一错误体 {code, message}，替换 Spring 默认的 whitelabel 格式。 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    public record ErrorBody(int code, String message) {
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorBody handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return new ErrorBody(400, message);
    }

    @ExceptionHandler(com.videotagger.metadata.MetadataProviderException.class)
    public org.springframework.http.ResponseEntity<ErrorBody> handleMetadataProvider(com.videotagger.metadata.MetadataProviderException e) {
        int status = e.status();
        org.springframework.http.HttpStatus httpStatus = org.springframework.http.HttpStatus.resolve(status);
        if (httpStatus == null || status < 400) httpStatus = org.springframework.http.HttpStatus.BAD_GATEWAY;
        return org.springframework.http.ResponseEntity.status(httpStatus)
                .body(new ErrorBody(status, e.getMessage() == null ? "元信息 Provider 请求失败" : e.getMessage()));
    }

    @ExceptionHandler(NoSuchElementException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorBody handleNotFound(NoSuchElementException e) {
        return new ErrorBody(404, e.getMessage() == null ? "not found" : e.getMessage());
    }

    /** 业务校验错误（撞名/被引用等）→ 400，避免落到 Exception 兜底变 500。 */
    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorBody handleIllegalArgument(IllegalArgumentException e) {
        return new ErrorBody(400, e.getMessage() == null ? "bad request" : e.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorBody handleIllegalState(IllegalStateException e) {
        return new ErrorBody(409, e.getMessage() == null ? "conflict" : e.getMessage());
    }
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ErrorBody handleOther(Exception e) {
        log.error("未处理异常", e);
        return new ErrorBody(500, "服务器内部错误");
    }
}
