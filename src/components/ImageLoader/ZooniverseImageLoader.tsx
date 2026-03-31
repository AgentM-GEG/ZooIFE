import { useState } from 'react';
import { useClassificationStore } from '../../stores/classificationStore';
import {
    loadImageAsDataUrl,
    getImageDimensions,
    normalizeImageForDisplay,
} from '../../services/imageService';
import { getQueuedSubjects } from '../../services/panoptesService';
import { useAuth } from '../../auth/AuthContext';
// import type { TokenSet } from '../../auth/tokenStore'
import type { Subject } from '../../types/panoptes'

/** Override via `.env`: `VITE_ZOONIVERSE_WORKFLOW_ID`, optional `VITE_ZOONIVERSE_SUBJECT_SET_ID`. */
const WORKFLOW_ID = import.meta.env.VITE_ZOONIVERSE_WORKFLOW_ID ?? '29070';
const SUBJECT_SET_ID = import.meta.env.VITE_ZOONIVERSE_SUBJECT_SET_ID?.trim() || undefined;
const QUEUE_OPTS = SUBJECT_SET_ID ? { subjectSetId: SUBJECT_SET_ID } : undefined;

export function ZooniverseImageLoader() {
    const { token } = useAuth();
    const [subjects, setSubjects] = useState<Subject[] | null>(null);
    const setSubject = useClassificationStore(s => s.setSubject);

    const processSubject = async (subject : Subject) => {
        try {
            const dataUrl = await loadImageAsDataUrl(subject.locations[0]["image/jpeg"]);
            // Normalize so display and SAM2 see the same pixels (fixes EXIF coordinate mismatch)
            const normalizedUrl = await normalizeImageForDisplay(dataUrl);
            const dims = await getImageDimensions(normalizedUrl);
            setSubject(subject.id, normalizedUrl, dims);
        } catch (err) {
            console.error('Failed to load image:', err);
        }
    }

    const handleFileChange = async () => {
        if (!token) return;

        // If no subjects loaded yet, fetch them FIRST and use them immediately
        if (!subjects || subjects.length === 0) {
            const newSubjects = await getQueuedSubjects(WORKFLOW_ID, token.access_token, QUEUE_OPTS);

            // Save to React state
            setSubjects(newSubjects);

            // Use them immediately (React state won't update yet)
            const [current, ...remaining] = newSubjects;
            setSubjects(remaining);

            await processSubject(current);
            return;
        }

        // We have subjects in state (safe to use)
        const [current, ...remaining] = subjects;
        setSubjects(remaining);

        await processSubject(current);
    };

    return (
        <div style={containerStyle}>
            {token &&
                <button onClick={handleFileChange} style={btnStyle}>
                    Next subject
                </button>}
        </div>
    );
}

const containerStyle: React.CSSProperties = { display: 'inline-block' };
const btnStyle: React.CSSProperties = {
    padding: '8px 16px',
    background: '#0f3460',
    border: '1px solid #e94560',
    borderRadius: 6,
    color: '#eee',
    cursor: 'pointer',
};
