import { render } from '@testing-library/react';

import IssueBadge from './IssueBadge';

describe('IssueBadge', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<IssueBadge />);
    expect(baseElement).toBeTruthy();
  });
});
