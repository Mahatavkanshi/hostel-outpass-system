"use client";

import { Camera, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { useToast } from "@/components/shared/toast";
import { Field } from "@/components/shared/ui";
import { api, descriptor, saveSession } from "@/lib/api";
import type { User } from "@/lib/types";

export function SignupForm() {
  const router = useRouter();
  const { showError, showToast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [descriptors, setDescriptors] = useState<number[][]>([]);
  const [error, setError] = useState("");

  async function startCamera() {
    const media = await navigator.mediaDevices.getUserMedia({ video: true });
    setStream(media);
    if (videoRef.current) videoRef.current.srcObject = media;
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 180;
    canvas
      .getContext("2d")
      ?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) return;
    const pixels = canvas.getContext("2d")?.getImageData(0, 0, 16, 8).data;
    const seed = pixels ? pixels[0] / 255 + photos.length : photos.length;
    setPhotos((current) => [...current, blob].slice(0, 3));
    setDescriptors((current) => [...current, descriptor(seed)].slice(0, 3));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (photos.length !== 3 || descriptors.length !== 3) {
      setError("Capture exactly 3 face photos before signup.");
      return;
    }
    const form = new FormData(event.currentTarget);
    form.set("descriptors", JSON.stringify(descriptors));
    photos.forEach((photo, index) => {
      form.append("facePhotos", photo, `face-${index + 1}.jpg`);
    });
    try {
      const data = await api<{ token: string; user: User }>(
        "/api/auth/signup",
        { method: "POST", body: form },
      );
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
      saveSession(data.token, data.user);
      showToast({
        kind: "success",
        title: "Registration submitted",
        body: "Wait for warden approval before requesting outpasses.",
      });
      router.push("/dashboard/student");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
      showError(err, "Signup failed");
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="name" label="Name" />
        <Field name="collegeId" label="College ID" />
      </div>
      <Field name="email" label="Email" type="email" />
      <Field name="password" label="Password" type="password" />
      <div className="rounded border border-zinc-200 p-3">
        <video
          ref={videoRef}
          className="h-48 w-full rounded bg-zinc-100 object-cover"
          autoPlay
          muted
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="icon-btn"
            onClick={startCamera}
            title="Start camera"
          >
            <Camera size={16} />
          </button>
          <button
            type="button"
            className="h-10 rounded bg-zinc-950 px-3 text-sm font-medium text-white"
            onClick={capture}
          >
            Capture {photos.length}/3
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setPhotos([]);
              setDescriptors([]);
            }}
            title="Reset captures"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="primary-btn w-full" type="submit">
        <Check size={16} /> Submit registration
      </button>
    </form>
  );
}
