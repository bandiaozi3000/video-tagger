package com.videotagger.videosource;

public final class VideoSourceStatus {
    private VideoSourceStatus() {
    }

    public enum Capability {
        DISCOVER_PACKAGES,
        PACKAGE_DETAILS,
        REFRESH_PACKAGE,
        RESOLVE_PLAYBACK,
        PROBE,
        DOWNLOAD,
        RANGE_DOWNLOAD,
        TRACK_METADATA,
        SOURCE_PAGE
    }

    public enum PackageState {
        CANDIDATE,
        ADOPTED,
        STALE,
        MISSING,
        DISABLED
    }

    public enum ItemKind {
        EPISODE,
        OVA,
        SPECIAL,
        MOVIE,
        MULTI_EPISODE,
        UNKNOWN
    }

    public enum MappingReason {
        PROVIDER_ID,
        EPISODE_NUMBER,
        TITLE_AND_NUMBER,
        MANUAL,
        MULTI_EPISODE,
        SPECIAL,
        IGNORED
    }

    public enum MappingState {
        PENDING,
        SUGGESTED,
        CONFIRMED,
        CONFLICT,
        IGNORED,
        MISSING
    }

    public enum AssetType {
        LOCAL_ORIGINAL,
        REMOTE_STREAM,
        DOWNLOADED,
        UPLOADED,
        GENERATED_CLIP,
        PROXY_TEMP
    }

    public enum AssetRole {
        PRIMARY,
        FALLBACK,
        UNASSIGNED
    }

    public enum AssetState {
        UNCHECKED,
        AVAILABLE,
        MISSING,
        CORRUPT,
        FAILED,
        DISABLED
    }

    public enum TrackType {
        VIDEO,
        AUDIO,
        SUBTITLE
    }

    public enum ProbeState {
        UNCHECKED,
        CHECKING,
        PLAYABLE,
        EXPIRED,
        LOGIN_REQUIRED,
        DRM_PROTECTED,
        GEO_BLOCKED,
        UNSUPPORTED_FORMAT,
        NOT_FOUND,
        TIMEOUT,
        PROVIDER_ERROR,
        FAILED,
        DISABLED
    }

    public enum ResolutionPurpose {
        PROBE,
        PLAYBACK,
        DOWNLOAD,
        MATERIALIZE
    }

    public enum TaskType {
        PROBE,
        DOWNLOAD_EPISODE,
        DOWNLOAD_RANGE,
        VERIFY_ASSET,
        MATERIALIZE_CLIP,
        CALIBRATE,
        CLEANUP_CACHE
    }

    public enum TaskState {
        QUEUED,
        RESOLVING,
        RUNNING,
        PAUSED,
        VERIFYING,
        COMPLETED,
        FAILED,
        CANCELED
    }

    public enum MaterialState {
        REFERENCE_ONLY,
        PREPARING,
        READY,
        FAILED
    }

    public enum TimeMappingState {
        UNMAPPED,
        AUTO_ESTIMATED,
        NEEDS_REVIEW,
        CONFIRMED,
        DRIFT_DETECTED,
        INCOMPATIBLE
    }
}
