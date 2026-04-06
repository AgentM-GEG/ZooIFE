import { useState } from 'react';
import styled from 'styled-components';
import { theme } from '../../theme/zooniverseTheme';
import { useClassificationStore } from '../../stores/classificationStore';
import {
    loadImageAsDataUrl,
    getImageDimensions,
    normalizeImageForDisplay,
} from '../../services/imageService';
import { getQueuedSubjects, getWorkflow, QueuedSubjectsOptions } from '../../services/panoptesService';
import { useAuth } from '../../auth/AuthContext';
// import type { TokenSet } from '../../auth/tokenStore'
import type { Subject } from '../../types/panoptes';
import type { CaesarAnnotation } from '../../types/annotations';
import { useCaesarClient, fetchCaesarReductions, CaesarReductionOptions, SubjectReduction } from '../../services/caesarService';

import { useCaesarAnnotationStore } from '../../stores/caesarReductionStore'

const Container = styled.div`
  display: inline-block;
`;

const Button = styled.button`
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  background: ${theme.colors.secondary};
  border: 1px solid ${theme.colors.primary};
  border-radius: ${theme.borders.radius.base};
  color: ${theme.colors.text.inverse};
  cursor: pointer;
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  transition: all ${theme.transitions.base};

  &:hover {
    background: ${theme.colors.primary};
    color: ${theme.colors.secondary};
  }

  &:active {
    transform: scale(0.95);
  }
`;

/** Override via `.env`: `VITE_ZOONIVERSE_WORKFLOW_ID`, optional `VITE_ZOONIVERSE_SUBJECT_SET_ID`. */
const USE_STAGING_APIS = import.meta.env.VITE_ZOONIVERSE_USE_STAGING_APIS === 'true';
const WORKFLOW_ID = import.meta.env.VITE_ZOONIVERSE_WORKFLOW_ID?.trim() ?? '29070';
const SUBJECT_SET_ID = import.meta.env.VITE_ZOONIVERSE_SUBJECT_SET_ID?.trim() || undefined;
const CEASAR_DEFAULT_TOOL_TYPE = import.meta.env.VITE_CEASAR_DEFAULT_TOOL_TYPE?.trim() || "default";

const QUEUE_OPTS: QueuedSubjectsOptions = { staging: USE_STAGING_APIS };

const CAESAR_REDUCTION_OPTS: CaesarReductionOptions = { staging: USE_STAGING_APIS, defaultToolType : CEASAR_DEFAULT_TOOL_TYPE };

if (SUBJECT_SET_ID) {
    QUEUE_OPTS.subjectSetId = SUBJECT_SET_ID;
}

/**
 * Zooniverse image loader component for loading subjects from the Zooniverse platform.
 * Fetches subjects from the configured workflow and processes Caesar ML annotations.
 */
export function ZooniverseImageLoader() {    
    const { token } = useAuth();
    const caesarClient = useCaesarClient(token?.access_token!, CAESAR_REDUCTION_OPTS);
    const [subjects, setSubjects] = useState<Subject[] | null>(null);
    const setSubject = useClassificationStore(s => s.setSubject);

    /**
     * Process Caesar ML reductions and convert to CaesarAnnotation format.
     * @param subject - Subject to fetch reductions for
     */
    const processCaesarReductions = async (subject: Subject) => {
            const reductions: SubjectReduction[] = await fetchCaesarReductions(caesarClient, "machineLearnt", subject.id, WORKFLOW_ID)
            
            // TODO: This should be elsewhere!!
            const workflow = await getWorkflow(WORKFLOW_ID, token?.access_token!, CAESAR_REDUCTION_OPTS.staging);            

            const parsed: CaesarAnnotation[] = reductions.flatMap(r => {
                const outer = Array.isArray(r.data) ? r.data : [r.data];

                return outer.flatMap(d => {
                    const inner = Array.isArray(d?.data) ? d.data : [];

                    return inner.map((b: any) => {
                        const taskIndex : number = b.taskIndex ?? 0;
                        const toolIndex : number = b.toolIndex ?? 0;
                        const markTool = workflow?.tasks?.[`T${taskIndex}`]?.tools?.[toolIndex];

                        if (markTool?.type === "rectangle") {
                            return {
                                toolType: "rectangle",
                                x_center: b.x_center,
                                y_center: b.y_center,
                                width: b.width,
                                height: b.height,
                                markId: b.markId ?? crypto.randomUUID(),
                                markColour: markTool.color,
                                markLabel: markTool.label
                            };
                        }
                        return { toolType: "custom", data: undefined };
                    });
                });
            });

            console.log(parsed);

            useCaesarAnnotationStore.getState().setAnnotations(parsed);
    }

    /**
     * Process subject: load image, normalize, and fetch Caesar annotations.
     * @param subject - Subject data from Zooniverse
     */
    const processSubject = async (subject: Subject) => {
        try {
            const dataUrl = await loadImageAsDataUrl(subject.locations[0]["image/jpeg"]);
            // Normalize so display and SAM2 see the same pixels (fixes EXIF coordinate mismatch)
            const normalizedUrl = await normalizeImageForDisplay(dataUrl);
            const dims = await getImageDimensions(normalizedUrl);
            setSubject(subject.id, normalizedUrl, dims);
            processCaesarReductions(subject);

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
        <Container>
            {token &&
                <Button onClick={handleFileChange}>
                    Next subject
                </Button>}
        </Container>
    );
}
