import type { ImageSourcePropType } from 'react-native';

import femaleAvatar01 from './customer/female/female_avatar_01.png';
import femaleAvatar02 from './customer/female/female_avatar_02.png';
import femaleAvatar03 from './customer/female/female_avatar_03.png';
import femaleAvatar04 from './customer/female/female_avatar_04.png';
import femaleAvatar05 from './customer/female/female_avatar_05.png';
import femaleAvatar06 from './customer/female/female_avatar_06.png';
import femaleAvatar07 from './customer/female/female_avatar_07.png';
import femaleAvatar08 from './customer/female/female_avatar_08.png';
import femaleAvatar09 from './customer/female/female_avatar_09.png';
import femaleAvatar10 from './customer/female/female_avatar_10.png';
import maleAvatar01 from './customer/male/male_avatar_01.png';
import maleAvatar02 from './customer/male/male_avatar_02.png';
import maleAvatar03 from './customer/male/male_avatar_03.png';
import maleAvatar04 from './customer/male/male_avatar_04.png';
import maleAvatar05 from './customer/male/male_avatar_05.png';
import maleAvatar06 from './customer/male/male_avatar_06.png';
import maleAvatar07 from './customer/male/male_avatar_07.png';
import maleAvatar08 from './customer/male/male_avatar_08.png';
import maleAvatar09 from './customer/male/male_avatar_09.png';
import maleAvatar10 from './customer/male/male_avatar_10.png';

type CustomerGender = 'man' | 'non-binary' | 'prefer-not-to-say' | 'woman';

export type CustomerAvatarGender = 'female' | 'male';

export type CustomerAvatarOption = {
  gender: CustomerAvatarGender;
  id: string;
  label: string;
  source: ImageSourcePropType;
  uri: string;
};

const customerAvatarUriPrefix = 'asset://connecto/customer-avatar';

const buildCustomerAvatarUri = (gender: CustomerAvatarGender, id: string) =>
  `${customerAvatarUriPrefix}/${gender}/${id}`;

const maleAvatarSources = {
  '01': maleAvatar01,
  '02': maleAvatar02,
  '03': maleAvatar03,
  '04': maleAvatar04,
  '05': maleAvatar05,
  '06': maleAvatar06,
  '07': maleAvatar07,
  '08': maleAvatar08,
  '09': maleAvatar09,
  '10': maleAvatar10,
} as const satisfies Record<string, ImageSourcePropType>;

const femaleAvatarSources = {
  '01': femaleAvatar01,
  '02': femaleAvatar02,
  '03': femaleAvatar03,
  '04': femaleAvatar04,
  '05': femaleAvatar05,
  '06': femaleAvatar06,
  '07': femaleAvatar07,
  '08': femaleAvatar08,
  '09': femaleAvatar09,
  '10': femaleAvatar10,
} as const satisfies Record<string, ImageSourcePropType>;

const createAvatarOptions = (
  gender: CustomerAvatarGender,
  sources: Record<string, ImageSourcePropType>,
) =>
  Object.entries(sources).map(
    ([id, source]) =>
      ({
        gender,
        id,
        label: `${gender === 'female' ? 'Female' : 'Male'} ${id}`,
        source,
        uri: buildCustomerAvatarUri(gender, id),
      }) satisfies CustomerAvatarOption,
  );

const maleCustomerAvatarOptions = createAvatarOptions(
  'male',
  maleAvatarSources,
);
const femaleCustomerAvatarOptions = createAvatarOptions(
  'female',
  femaleAvatarSources,
);

export const customerAvatarOptions = {
  female: femaleCustomerAvatarOptions,
  male: maleCustomerAvatarOptions,
} as const satisfies Record<CustomerAvatarGender, CustomerAvatarOption[]>;

const allCustomerAvatarOptions = [
  ...femaleCustomerAvatarOptions,
  ...maleCustomerAvatarOptions,
] as const satisfies CustomerAvatarOption[];

const customerAvatarOptionByUri = new Map(
  allCustomerAvatarOptions.map((option) => [option.uri, option]),
);

const customerAvatarGenderForProfileGender = (
  gender: CustomerGender | null | undefined,
): CustomerAvatarGender | null =>
  gender === 'woman' ? 'female' : gender === 'man' ? 'male' : null;

const legacyAvatarIndexFromUri = (uri: string) => {
  const match =
    /mock:\/\/connecto\/customer\/(?:host-avatar|profile-image)-(\d+)/.exec(
      uri,
    );

  if (match === null) {
    return null;
  }

  const index = Number.parseInt(match[1] ?? '1', 10);

  if (!Number.isFinite(index)) {
    return null;
  }

  return Math.min(10, Math.max(1, index));
};

export const getCustomerAvatarOptionsForGender = (
  gender: CustomerGender | null | undefined,
) => {
  const avatarGender = customerAvatarGenderForProfileGender(gender);

  if (avatarGender === null) {
    return allCustomerAvatarOptions;
  }

  return customerAvatarOptions[avatarGender];
};

export const defaultCustomerAvatarUriForGender = (
  gender: CustomerGender | null | undefined,
) =>
  getCustomerAvatarOptionsForGender(gender)[0]?.uri ??
  buildCustomerAvatarUri('female', '01');

export const normalizeCustomerAvatarUri = (
  uri: string | null | undefined,
  gender?: CustomerGender | null,
) => {
  if (uri === null || uri === undefined) {
    return undefined;
  }

  const existingAvatar = customerAvatarOptionByUri.get(uri);

  if (existingAvatar !== undefined) {
    const avatarGender = customerAvatarGenderForProfileGender(gender);

    if (avatarGender === null || existingAvatar.gender === avatarGender) {
      return uri;
    }

    return defaultCustomerAvatarUriForGender(gender);
  }

  const legacyIndex = legacyAvatarIndexFromUri(uri);

  if (legacyIndex !== null) {
    const avatarGender = customerAvatarGenderForProfileGender(gender);
    const fallbackGender = avatarGender ?? 'female';
    const id = String(legacyIndex).padStart(2, '0');

    return buildCustomerAvatarUri(fallbackGender, id);
  }

  if (uri.startsWith('preset://connecto/customer-avatar/')) {
    return defaultCustomerAvatarUriForGender(gender);
  }

  return undefined;
};

export const resolveCustomerAvatar = (
  uri: string | null | undefined,
  gender?: CustomerGender | null,
) => {
  const normalizedUri = normalizeCustomerAvatarUri(uri, gender);

  return normalizedUri === undefined
    ? undefined
    : customerAvatarOptionByUri.get(normalizedUri);
};

export const resolveCustomerAvatarSource = (
  uri: string | null | undefined,
  gender?: CustomerGender | null,
) => resolveCustomerAvatar(uri, gender)?.source;
