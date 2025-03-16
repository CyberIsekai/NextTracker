from fastapi import status

from apps.base.tests.store import TS
from apps.base.schemas.main import C

from apps.tracker.schemas.main import ImageGameMaps


def test_images_get():
    # set user token for notes path
    TS.set_role_token(C.GUEST)

    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/images')
    TS.check_response(
        resp,
        status.HTTP_401_UNAUTHORIZED,
        test_images_get.__name__,
        (C.DETAIL, f'{C.GUEST} {C.TOKEN}'),
    )

    TS.set_role_token(C.ADMIN)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/images')
    TS.check_response(resp, status.HTTP_200_OK, test_images_get.__name__)
    result: ImageGameMaps = resp.json()
    assert result.get(C.MW_MP) is not None


# def images_upload(filename: str):
#     name = filename.split('.', maxsplit=1)[0]
#     file = Path.cwd().parent / C.STATIC / C.FILES / filename
#     file = open(file, 'rb')
#     files = {name: file}
#     # files = {'file': (name, file, 'image/jpeg')}
#     # headers = {
#     #     'Content-Type': 'multipart/form-data',
#     # } , headers=headers

#     resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/images', files=files)
#     TS.check_status_code(resp, status.HTTP_200_OK)
#     result: ImageUpload = resp.json()
#     assert result[C.FILES][0].get(NAME) == name

#     return result


# async def images_upload(request: Request, file: UploadFile = File(...)):
#     uploaded_files = request.files.getlist('file')
#     return {
#         C.FILES: [{
#             'name': uploaded_files[0]['name'],
#             'b64_thumb': '',
#             'b64_full': ''
#         }],
#         'epoch': ''
#     }
#     return {'filename': file.filename}


# def test_images_upload():
#     images_upload('sample.jpg')


# def test_images_submit():
#     res = images_upload('sample.jpg')

#     images = list(map(lambda file: file.get(NAME), res[C.FILES]))

#     body: ImageUploadSubmit = {
#         'images': images,
#         EPOCH: res[EPOCH],
#         GAME_MODE: MW_WZ
#     }

#     resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/images', json=body)
#     TS.check_status_code(resp, status.HTTP_200_OK)
#     result: Message = resp.json()
#     assert result.get(MESSAGE) == f"Maps added [{len(body['images'])}] {body[GAME]} {body[MODE]}"


# def test_images_put():
#     body: ImageData = {
#         NAME: TS.non_exist_name,
#         'new_name': 'new_name_sample',
#         GAME_MODE: MW_WZ
#     }

#     # non exist
#     resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/images', json=body)
#     TS.check_status_code(resp, status.HTTP_404_NOT_FOUND)
#     result: Error = resp.json()
#     assert result.get(DETAIL) == f"Map {body[GAME]} {body[MODE]} {body[NAME]} {NOT_FOUND}"

#     body[NAME] = 'sample'
#     # exist
#     resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/images', json=body)
#     TS.check_status_code(resp, status.HTTP_200_OK)
#     result: Message = resp.json()
#     assert result.get(MESSAGE) == f"Map {body[NAME]} renamed to {body['new_name']}"


# def test_images_delete():

#     body: ImageData = {
#         NAME: 'new_name_sample',
#         'new_name': '',
#         GAME_MODE: MW_WZ
#     }

#     resp = TS.client.delete(f'{TS.FASTAPI_API_PATH}/images', json=body)
#     TS.check_status_code(resp, status.HTTP_200_OK)
#     result: Message = resp.json()
#     assert result.get(MESSAGE) == f"Map {body[NAME]} {DELETED}"
