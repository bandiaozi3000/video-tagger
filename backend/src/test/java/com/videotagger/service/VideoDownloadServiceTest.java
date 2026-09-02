package com.videotagger.service;
import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.VideoAssetMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.http.*;
import java.nio.file.*;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
class VideoDownloadServiceTest {
 @TempDir Path temp;
 @Test void insufficientDiskFailsBeforeNetwork() throws Exception{VideoAssetMapper mapper=mock(VideoAssetMapper.class);HttpClient client=mock(HttpClient.class);VideoAsset asset=asset();when(mapper.selectById(1L)).thenReturn(asset);VideoDownloadService service=new VideoDownloadService(mapper,temp.toString(),client,false);assertThrows(IllegalStateException.class,()->service.download(1,1,1,1,"https://example.com/a.mp4",Long.MAX_VALUE));verify(client,never()).send(any(),any());}
 @Test void invalidMimeDeletesPartAndDoesNotPromote() throws Exception{VideoAssetMapper mapper=mock(VideoAssetMapper.class);HttpClient client=mock(HttpClient.class);VideoAsset asset=asset();when(mapper.selectById(1L)).thenReturn(asset);HttpResponse<InputStream> response=response("text/html",new ByteArrayInputStream("bad".getBytes()));when(client.send(any(),any(HttpResponse.BodyHandler.class))).thenReturn(response);VideoDownloadService service=new VideoDownloadService(mapper,temp.toString(),client,false);assertThrows(IllegalStateException.class,()->service.download(1,1,1,1,"https://example.com/a.mp4",1024));assertEquals("UNCHECKED",asset.getAvailabilityState());}
 @Test void interruptedBodyRemovesTemporaryFile() throws Exception{VideoAssetMapper mapper=mock(VideoAssetMapper.class);HttpClient client=mock(HttpClient.class);VideoAsset asset=asset();when(mapper.selectById(1L)).thenReturn(asset);InputStream broken=new InputStream(){int count;public int read() throws IOException{if(count++<3)return 1;throw new IOException("interrupted");}};HttpResponse<InputStream> brokenResponse=response("video/mp4",broken);when(client.send(any(),any(HttpResponse.BodyHandler.class))).thenReturn(brokenResponse);VideoDownloadService service=new VideoDownloadService(mapper,temp.toString(),client,false);assertThrows(IOException.class,()->service.download(1,1,1,1,"https://example.com/a.mp4",1024));assertEquals(0,Files.walk(temp).filter(p->p.getFileName().toString().contains(".part")).count());}
 private VideoAsset asset(){VideoAsset a=new VideoAsset();a.setId(1L);a.setAvailabilityState("UNCHECKED");return a;}
 @SuppressWarnings("unchecked") private HttpResponse<InputStream> response(String type,InputStream body){HttpResponse<InputStream> r=mock(HttpResponse.class);HttpHeaders h=HttpHeaders.of(java.util.Map.of("content-type",java.util.List.of(type)),(a,b)->true);when(r.statusCode()).thenReturn(200);when(r.headers()).thenReturn(h);when(r.body()).thenReturn(body);return r;}
}