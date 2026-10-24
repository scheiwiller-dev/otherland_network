import { describe, expect, it } from 'vitest';
import { personLabel } from './principalLabel.js';

describe('personLabel', () => {
    it('shows a username with the principal as secondary text', () => {
        expect(personLabel('aaaaa-aa', ['ada'])).toEqual({
            primary: 'ada',
            secondary: 'aaaaa-aa',
        });
    });

    it('shows the principal alone when no username is registered', () => {
        expect(personLabel('aaaaa-aa', [])).toEqual({
            primary: 'aaaaa-aa',
            secondary: '',
        });
    });
});
