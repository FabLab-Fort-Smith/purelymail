import { useState, type ReactElement } from 'react';
import { Box, Text } from 'ink';
import type { NewRoutingForm } from '../../mutations.js';
import { TextField } from './TextField.js';
import { YesNoField } from './YesNoField.js';

/** Props for {@link CreateRoutingForm}. */
export interface CreateRoutingFormProps {
  /** Pre-fill the domain (e.g. from the selected account/rule). */
  readonly domainHint?: string;
  /** Called with the collected form once all fields are entered. */
  readonly onSubmit: (form: NewRoutingForm) => void;
  /** Called on Esc. */
  readonly onCancel: () => void;
}

type Step = 'domain' | 'match' | 'targets' | 'prefix' | 'catchall';

/** A completed-field summary line. */
function Done({ label, value }: { readonly label: string; readonly value: string }): ReactElement {
  return (
    <Text>
      <Text dimColor>{label}: </Text>
      {value}
    </Text>
  );
}

/**
 * A stepped form to create a routing rule: domain, match (local part, blank =
 * catchall base), comma-separated targets, then the prefix and catchall flags.
 * Enter advances (text fields), `y`/`n` answers the flags, Esc cancels.
 *
 * @param props - Domain hint + submit/cancel callbacks.
 * @returns The form tree.
 */
export function CreateRoutingForm({
  domainHint,
  onSubmit,
  onCancel,
}: CreateRoutingFormProps): ReactElement {
  const [step, setStep] = useState<Step>('domain');
  const [domain, setDomain] = useState(domainHint ?? '');
  const [matchUser, setMatchUser] = useState('');
  const [targets, setTargets] = useState('');
  const [prefix, setPrefix] = useState(false);

  return (
    <Box flexDirection="column">
      <Text bold color="green">
        New routing rule
      </Text>
      {step !== 'domain' ? <Done label="domain" value={domain} /> : null}
      {step === 'targets' || step === 'prefix' || step === 'catchall' ? (
        <Done label="match" value={matchUser === '' ? '(catchall base)' : matchUser} />
      ) : null}
      {step === 'prefix' || step === 'catchall' ? <Done label="targets" value={targets} /> : null}
      {step === 'catchall' ? <Done label="prefix" value={prefix ? 'yes' : 'no'} /> : null}

      {step === 'domain' ? (
        <TextField
          label="domain"
          initial={domain}
          onCancel={onCancel}
          onSubmit={(v) => {
            setDomain(v.trim());
            setStep('match');
          }}
        />
      ) : null}
      {step === 'match' ? (
        <TextField
          label="match local part (blank = catchall)"
          onCancel={onCancel}
          onSubmit={(v) => {
            setMatchUser(v.trim());
            setStep('targets');
          }}
        />
      ) : null}
      {step === 'targets' ? (
        <TextField
          label="targets (comma-separated)"
          onCancel={onCancel}
          onSubmit={(v) => {
            setTargets(v);
            setStep('prefix');
          }}
        />
      ) : null}
      {step === 'prefix' ? (
        <YesNoField
          label="prefix match?"
          onCancel={onCancel}
          onSubmit={(v) => {
            setPrefix(v);
            setStep('catchall');
          }}
        />
      ) : null}
      {step === 'catchall' ? (
        <YesNoField
          label="catchall?"
          onCancel={onCancel}
          onSubmit={(catchall) => {
            onSubmit({ domain, matchUser, targets, prefix, catchall });
          }}
        />
      ) : null}

      <Text dimColor>[enter]/[y/n] next [esc] cancel</Text>
    </Box>
  );
}
