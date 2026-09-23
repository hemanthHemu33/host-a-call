declare module '*.ttf' {
  const asset: number;

  export default asset;
}

declare module '*.lottie' {
  const asset: number;

  export default asset;
}

declare module '*.jpeg' {
  import type { ImageSourcePropType } from 'react-native';

  const asset: ImageSourcePropType;

  export default asset;
}

declare module '*.jpg' {
  import type { ImageSourcePropType } from 'react-native';

  const asset: ImageSourcePropType;

  export default asset;
}

declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';

  const asset: ImageSourcePropType;

  export default asset;
}

declare module '*.riv' {
  const asset: number;

  export default asset;
}
