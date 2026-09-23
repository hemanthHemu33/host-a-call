import { fireEvent, render, screen } from '@testing-library/react-native';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './controls';
import { Checkbox, OTPInput } from './fields';

describe('mobile UI components', () => {
  it('fires enabled button presses and exposes loading state', () => {
    const onPress = vi.fn();

    void render(
      <Button loading onPress={onPress} testID="save-button" title="Save" />,
    );

    const button = screen.getByTestId('save-button');

    expect(button.props.accessibilityState).toMatchObject({
      busy: true,
      disabled: true,
    });

    void fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('updates OTP digits deterministically', () => {
    const onChange = vi.fn();

    void render(<OTPInput onChange={onChange} testID="otp" value="12" />);

    void fireEvent.changeText(screen.getByTestId('otp-hidden-input'), '123456');

    expect(onChange).toHaveBeenCalledWith('123456');
  });

  it('exposes checkbox checked and disabled accessibility state', () => {
    void render(<Checkbox checked disabled label="Accept terms" />);

    expect(screen.getByRole('checkbox').props.accessibilityState).toMatchObject(
      {
        checked: true,
        disabled: true,
      },
    );
  });
});
