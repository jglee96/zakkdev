import { render } from '@testing-library/react';

import DarkModeSelector from './DarkModeSelector';

describe('DarkModeSelector', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<DarkModeSelector />);
    expect(baseElement).toBeTruthy();
  });
});
