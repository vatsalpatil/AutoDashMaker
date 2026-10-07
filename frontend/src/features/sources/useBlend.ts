import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Dataset, DatasetSchema, RelationshipSuggestion } from '@/lib/types';

/** State and actions of the "Blend datasets" dialog: both sides' schemas, suggested joins, live SQL preview, create. */
export function useBlend(isOpen: boolean, onClose: () => void, datasets: Dataset[]) {
  const navigate = useNavigate();
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [leftSchema, setLeftSchema] = useState<DatasetSchema | null>(null);
  const [rightSchema, setRightSchema] = useState<DatasetSchema | null>(null);
  const [leftCol, setLeftCol] = useState('');
  const [rightCol, setRightCol] = useState('');
  const [joinType, setJoinType] = useState<'left' | 'inner' | 'full'>('left');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [suggestions, setSuggestions] = useState<RelationshipSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showSql, setShowSql] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    api
      .get<RelationshipSuggestion[]>('/transforms/relationships/suggest')
      .then(setSuggestions)
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!leftId) {
      setLeftSchema(null);
      setLeftCol('');
      return;
    }
    api
      .get<DatasetSchema>(`/datasets/${leftId}/schema`)
      .then(setLeftSchema)
      .catch(() => setLeftSchema(null));
  }, [leftId]);

  useEffect(() => {
    if (!rightId) {
      setRightSchema(null);
      setRightCol('');
      return;
    }
    api
      .get<DatasetSchema>(`/datasets/${rightId}/schema`)
      .then(setRightSchema)
      .catch(() => setRightSchema(null));
  }, [rightId]);

  const leftDs = datasets.find((d) => d.id === leftId);
  const rightDs = datasets.find((d) => d.id === rightId);
  const leftName = leftDs?.name ?? '';
  const rightName = rightDs?.name ?? '';
  const effectiveName = nameTouched
    ? name
    : leftName && rightName
    ? `${leftName}_x_${rightName}`
    : name;

  function applySuggestion(s: RelationshipSuggestion) {
    setLeftId(s.left_dataset_id);
    setRightId(s.right_dataset_id);
    setLeftCol(s.left_column);
    setRightCol(s.right_column);
  }

  // Live SQL preview generator
  const generatedSql =
    leftDs && rightDs && leftCol && rightCol
      ? `SELECT l.*, r.* FROM ${leftDs.physical_name || leftDs.name} l\n${
          joinType === 'left' ? 'LEFT JOIN' : joinType === 'inner' ? 'INNER JOIN' : 'FULL OUTER JOIN'
        } ${rightDs.physical_name || rightDs.name} r\n  ON l."${leftCol}" = r."${rightCol}"`
      : '';

  async function create() {
    setError(null);
    setCreating(true);
    try {
      const r = await api.post<Dataset>('/transforms/blend', {
        name: effectiveName,
        left_dataset_id: leftId,
        right_dataset_id: rightId,
        left_column: leftCol,
        right_column: rightCol,
        join_type: joinType,
      });
      onClose();
      navigate(`/datasets/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  }

  return { leftId, setLeftId, rightId, setRightId, leftSchema, setLeftSchema, rightSchema, setRightSchema, leftCol, setLeftCol, rightCol, setRightCol, joinType, setJoinType, name, setName, nameTouched, setNameTouched, suggestions, setSuggestions, error, setError, creating, setCreating, showSql, setShowSql, leftDs, rightDs, leftName, rightName, effectiveName, applySuggestion, generatedSql, create };
}
