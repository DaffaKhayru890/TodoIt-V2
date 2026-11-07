import { t } from 'elysia';
import { errorResponseSchema } from '../../../../shared/presentation/http/errors/error-response';

export const registerBodySchema = t.Object(
  {
    email: t.String({
      format: 'email',
      minLength: 3,
      maxLength: 320,
      description: 'Alamat email pengguna; akan dinormalisasi (lowercase dan trim).'
    }),
    displayName: t.String({
      minLength: 1,
      maxLength: 80,
      description: 'Nama tampilan pengguna.'
    }),
    password: t.String({
      minLength: 12,
      maxLength: 128,
      description: 'Password pengguna (minimal 12 karakter, maksimal 128 karakter).'
    })
  },
  {
    title: 'RegisterUserInput',
    description: 'Data untuk registrasi pengguna baru.'
  }
);

export const registerResponseSchema = t.Object(
  {
    user: t.Object({
      id: t.String({ format: 'uuid', description: 'ID pengguna unik (UUID).' }),
      email: t.String({ format: 'email', description: 'Email kanonikal pengguna.' }),
      displayName: t.String({ description: 'Nama tampilan pengguna.' }),
      createdAt: t.Date({ description: 'Waktu pembuatan akun.' })
    })
  },
  {
    title: 'RegisterResponse',
    description: 'Respons berhasil setelah pendaftaran akun baru.'
  }
);

export const loginBodySchema = t.Object(
  {
    email: t.String({
      description: 'Alamat email pengguna.'
    }),
    password: t.String({
      description: 'Password pengguna.'
    })
  },
  {
    title: 'LoginUserInput',
    description: 'Kredensial untuk masuk ke akun.'
  }
);

export const loginResponseSchema = t.Object(
  {
    user: t.Object({
      id: t.String({ format: 'uuid', description: 'ID pengguna.' }),
      email: t.String({ format: 'email', description: 'Email pengguna.' }),
      displayName: t.String({ description: 'Nama tampilan pengguna.' })
    }),
    accessToken: t.String({ description: 'JWT access token bertipe Bearer.' }),
    tokenType: t.Literal('Bearer', { description: 'Tipe token autentikasi.' }),
    expiresIn: t.Number({ description: 'Masa berlaku token dalam detik.' })
  },
  {
    title: 'LoginResponse',
    description: 'Respons berhasil login; refresh token disematkan pada HttpOnly cookie.'
  }
);

export const refreshResponseSchema = t.Object(
  {
    accessToken: t.String({ description: 'JWT access token baru bertipe Bearer.' }),
    tokenType: t.Literal('Bearer', { description: 'Tipe token autentikasi.' }),
    expiresIn: t.Number({ description: 'Masa berlaku token dalam detik.' })
  },
  {
    title: 'RefreshResponse',
    description: 'Respons berhasil refresh access token; refresh token dirotasi pada HttpOnly cookie.'
  }
);

export const currentUserResponseSchema = t.Object(
  {
    user: t.Object({
      id: t.String({ format: 'uuid', description: 'ID pengguna saat ini.' }),
      email: t.String({ format: 'email', description: 'Email pengguna saat ini.' }),
      displayName: t.String({ description: 'Nama tampilan pengguna.' })
    })
  },
  {
    title: 'CurrentUserResponse',
    description: 'Informasi profil pengguna yang sedang terautentikasi.'
  }
);

export { errorResponseSchema };
