package com.videotagger.service;
import com.videotagger.mapper.*;
import com.videotagger.videosource.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
class VideoSourcePlaybackServiceTest {
 @Test void expiredResolutionIsRejected(){FakeVideoSourceProvider provider=new FakeVideoSourceProvider("fake").addResolution("pkg","item","r1","https://example.com/a.mp4",Instant.now().minusSeconds(1));VideoSourcePlaybackService service=service(provider);VideoSourceProviderException error=assertThrows(VideoSourceProviderException.class,()->service.resolve("fake","pkg","item","r1"));assertEquals("RESOLUTION_EXPIRED",error.reasonCode());}
 @Test void loginAndDrmStatesRemainExplicit(){FakeVideoSourceProvider login=new FakeVideoSourceProvider("login").addResolution("pkg","item","r1","https://example.com/a.mp4",Instant.now().plusSeconds(60)).probeState(VideoSourceStatus.ProbeState.LOGIN_REQUIRED);assertEquals(VideoSourceStatus.ProbeState.LOGIN_REQUIRED,service(login).probe("login","pkg","item","r1").state());FakeVideoSourceProvider drm=new FakeVideoSourceProvider("drm").addResolution("pkg","item","r1","https://example.com/a.mp4",Instant.now().plusSeconds(60)).probeState(VideoSourceStatus.ProbeState.DRM_PROTECTED);assertEquals(VideoSourceStatus.ProbeState.DRM_PROTECTED,service(drm).probe("drm","pkg","item","r1").state());}
 private VideoSourcePlaybackService service(VideoSourceProvider provider){return new VideoSourcePlaybackService(new VideoSourceProviderRegistry(List.of(provider)),mock(VideoAssetMapper.class),mock(VideoSourceItemMapper.class),mock(VideoSourcePackageMapper.class),mock(VideoSourceResolutionCacheMapper.class));}
}