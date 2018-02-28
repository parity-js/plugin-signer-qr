// Copyright 2015-2017 Parity Technologies (UK) Ltd.
// This file is part of Parity.

// Parity is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Parity is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

import React from 'react';
import SignerRequest from '@parity/ui/lib/Signer/Request';

import ConfirmViaQr from './ConfirmViaQr';

export default function Request ({ ...props }) {
  return <SignerRequest confirmElement={ ConfirmViaQr } { ...props } />;
}
