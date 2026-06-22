import { Image } from "lucide-react";
import { useEffect, useState } from "react";

import { getPhoto, getPhotosByIds } from "../../db/repositories";

type PhotoThumbnailProps = {
  photoId?: string;
  alt: string;
  className?: string;
};

export function PhotoThumbnail({ photoId, alt, className = "" }: PhotoThumbnailProps) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let objectUrl = "";
    let isMounted = true;

    async function loadPhoto() {
      if (!photoId) {
        return;
      }
      const photo = await getPhoto(photoId);
      if (!photo || !isMounted) {
        return;
      }
      objectUrl = URL.createObjectURL(photo.thumbnailBlob);
      setUrl(objectUrl);
    }

    void loadPhoto();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photoId]);

  if (!photoId || !url) {
    return (
      <div className={`grid place-items-center bg-gradient-to-br from-orange/20 via-white to-blue/25 text-muted ${className}`}>
        <Image size={22} aria-hidden="true" />
      </div>
    );
  }

  return <img src={url} alt={alt} className={`object-cover ${className}`} loading="lazy" />;
}

type PhotoGalleryProps = {
  photoIds: string[];
  altPrefix: string;
};

export function PhotoGallery({ photoIds, altPrefix }: PhotoGalleryProps) {
  const [urls, setUrls] = useState<Array<{ id: string; url: string }>>([]);

  useEffect(() => {
    let objectUrls: Array<{ id: string; url: string }> = [];
    let isMounted = true;

    async function loadPhotos() {
      const photos = await getPhotosByIds(photoIds);
      objectUrls = photos.map((photo) => ({
        id: photo.id,
        url: URL.createObjectURL(photo.blob),
      }));
      if (isMounted) {
        setUrls(objectUrls);
      }
    }

    void loadPhotos();

    return () => {
      isMounted = false;
      objectUrls.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [photoIds]);

  if (photoIds.length === 0) {
    return null;
  }

  if (urls.length === 0) {
    return (
      <section className="rounded-card bg-white/78 p-5 shadow-soft">
        <h2 className="text-lg font-semibold text-ink">图片</h2>
        <p className="mt-3 text-sm text-muted">正在读取图片。</p>
      </section>
    );
  }

  return (
    <section className="rounded-card bg-white/78 p-5 shadow-soft">
      <h2 className="text-lg font-semibold text-ink">图片</h2>
      <div className="mt-4 space-y-3">
        {urls.map((item, index) => (
          <img
            key={item.id}
            src={item.url}
            alt={`${altPrefix} 图片 ${index + 1}`}
            className="max-h-[520px] w-full rounded-[20px] object-cover"
          />
        ))}
      </div>
    </section>
  );
}
